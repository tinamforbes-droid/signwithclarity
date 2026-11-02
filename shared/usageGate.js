import { createHmac, randomUUID } from "node:crypto";
import { getStore } from "@netlify/blobs";

import { hasUnlimitedAccess } from "./access.js";
import { asLanguage, t } from "./messages.js";
import { bearerToken, isUserId } from "./session.js";
import { verifySupabaseUser } from "./supabaseUser.js";
import {
  FREE_EXPLANATION_LIMIT,
  MAX_CALLS_PER_EXPLANATION,
  formatResetDate,
  monthKey,
  resetsOnIso,
  usageSnapshot,
} from "./usageCopy.js";

/**
 * Fallback salt so the limit works before anyone sets USAGE_HASH_SALT.
 * A value in Netlify's environment variables replaces this. Changing the
 * salt later starts everyone's monthly count over, because the stored key
 * changes.
 */
export const BUILT_IN_USAGE_SALT = "signwithclarity-usage-v1";

const EXPLANATION_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const COMMIT_ATTEMPTS = 6;

export function usageSalt(env = process.env) {
  const configured = String(env?.USAGE_HASH_SALT || "").trim();
  return configured || BUILT_IN_USAGE_SALT;
}

export function usageStorageKey(ip, salt) {
  return createHmac("sha256", salt).update(String(ip)).digest("hex");
}

function headerValue(headers, name) {
  if (!headers) return "";
  const wanted = name.toLowerCase();
  for (const [key, value] of Object.entries(headers)) {
    if (String(key).toLowerCase() !== wanted) continue;
    return Array.isArray(value) ? String(value[0] ?? "") : String(value ?? "");
  }
  return "";
}

/**
 * Netlify sets x-nf-client-connection-ip. A visitor-supplied
 * x-forwarded-for is ignored so the limit cannot be reset by sending a
 * new header.
 */
export function clientIp(headers) {
  const direct = headerValue(headers, "x-nf-client-connection-ip")
    || headerValue(headers, "client-ip");
  const ip = direct.split(",")[0].trim();
  if (ip) return ip.slice(0, 80);
  return "unknown";
}

export function cleanExplanationId(value) {
  const text = String(value ?? "").trim().toLowerCase();
  return EXPLANATION_ID.test(text) ? text : "";
}

export function isNetlifyRuntime(env = process.env) {
  if (env.NETLIFY === "true") return true;
  if (env.AWS_LAMBDA_FUNCTION_NAME) return true;
  if (env.NETLIFY_BLOBS_CONTEXT) return true;
  return String(env.AWS_EXECUTION_ENV || "").includes("AWS_Lambda");
}

export function createMemoryUsageStore() {
  const map = new Map();
  return {
    async get(key) {
      const entry = map.get(key);
      if (!entry) return { value: null, etag: null };
      return { value: JSON.parse(entry.json), etag: entry.etag };
    },
    async compareAndSet(key, value, etag) {
      const entry = map.get(key);
      const current = entry?.etag ?? null;
      if ((etag ?? null) !== current) return false;
      const next = String((Number(current) || 0) + 1);
      map.set(key, { json: JSON.stringify(value), etag: next });
      return true;
    },
    snapshot() {
      const out = {};
      for (const [key, entry] of map) out[key] = JSON.parse(entry.json);
      return out;
    },
  };
}

export function adaptBlobStore(store) {
  return {
    async get(key) {
      const entry = await store.getWithMetadata(key, { type: "json" });
      if (!entry) return { value: null, etag: null };
      return { value: entry.data, etag: entry.etag || null };
    },
    async compareAndSet(key, value, etag) {
      const options = etag ? { onlyIfMatch: etag } : { onlyIfNew: true };
      const result = await store.setJSON(key, value, options);
      return Boolean(result?.modified);
    },
  };
}

export async function resolveUsageStore(context, env = process.env) {
  if (context && Object.prototype.hasOwnProperty.call(context, "usageStore")) {
    return context.usageStore;
  }
  if (!isNetlifyRuntime(env)) return null;
  return adaptBlobStore(getStore({ name: "swc-usage", consistency: "strong" }));
}

function sanitizeExplanations(value) {
  const out = {};
  if (!value || typeof value !== "object" || Array.isArray(value)) return out;
  for (const [id, calls] of Object.entries(value)) {
    if (!EXPLANATION_ID.test(id)) continue;
    if (!Number.isInteger(calls) || calls < 1) continue;
    out[id] = Math.min(calls, MAX_CALLS_PER_EXPLANATION);
  }
  return out;
}

function currentRecord(raw, month) {
  if (!raw || typeof raw !== "object" || raw.month !== month) {
    return { month, used: 0, explanations: {} };
  }
  const explanations = sanitizeExplanations(raw.explanations);
  return { month, used: Object.keys(explanations).length, explanations };
}

function decide(raw, month, explanationId) {
  const record = currentRecord(raw, month);
  const calls = record.explanations[explanationId];
  if (Number.isInteger(calls)) {
    if (calls >= MAX_CALLS_PER_EXPLANATION) {
      return { write: false, allowed: false, reason: "closed", fresh: false, record };
    }
    return {
      write: true,
      allowed: true,
      fresh: false,
      record: {
        month,
        explanations: { ...record.explanations, [explanationId]: calls + 1 },
        used: record.used,
      },
    };
  }
  if (record.used >= FREE_EXPLANATION_LIMIT) {
    return { write: false, allowed: false, reason: "limit", fresh: false, record };
  }
  const explanations = { ...record.explanations, [explanationId]: 1 };
  return {
    write: true,
    allowed: true,
    fresh: true,
    record: { month, explanations, used: Object.keys(explanations).length },
  };
}

async function commit(store, key, update) {
  for (let attempt = 0; attempt < COMMIT_ATTEMPTS; attempt++) {
    const current = await store.get(key);
    const result = update(current.value);
    if (!result.write) return result;
    const ok = await store.compareAndSet(key, result.record, current.etag);
    if (ok) return result;
  }
  const error = new Error("usage store busy");
  error.code = "usage_busy";
  throw error;
}

async function releaseReservation(store, key, explanationId, month) {
  try {
    await commit(store, key, (raw) => {
      const record = currentRecord(raw, month);
      if (record.explanations[explanationId] !== 1) return { write: false, record };
      const explanations = { ...record.explanations };
      delete explanations[explanationId];
      return {
        write: true,
        record: { month, explanations, used: Object.keys(explanations).length },
      };
    });
  } catch {
    console.error("usage release failed");
  }
}

/**
 * Who the monthly count belongs to. A confirmed account id is hashed on
 * its own. Otherwise the count stays on the connection, exactly as before.
 * The email address is not part of the key.
 */
export function usageSubject(user, headers) {
  const id = String(user?.id ?? "").trim().toLowerCase();
  if (isUserId(id)) return `user:${id}`;
  return clientIp(headers);
}

function confirmedUser(user) {
  const id = String(user?.id ?? "").trim().toLowerCase();
  if (!isUserId(id)) return null;
  return { id };
}

/**
 * A bearer token is checked with Supabase. A user id in the body is ignored.
 * If the check cannot be finished, the person is treated as signed out, so
 * a made-up token does not open a new count.
 */
async function resolveAccount(headers, env, verifySession) {
  const token = bearerToken(headers);
  if (!token) return null;
  const verify = typeof verifySession === "function" ? verifySession : verifySupabaseUser;
  try {
    const user = await verify({ token, env, fetchImpl: globalThis.fetch });
    return confirmedUser(user);
  } catch {
    console.error("session check failed");
    return null;
  }
}

/**
 * Count one free explanation, or refuse it before the model is called.
 * The stored record is a hash key plus a month, a count, and random ids.
 * It never includes the document, the notes, the IP address, or the email.
 */
export async function enforceUsageLimit({
  headers,
  payload,
  store,
  env = process.env,
  now = new Date(),
  hasUnlimitedAccess: accessOverride,
  verifySession,
  language = "en",
}) {
  const lang = asLanguage(language) || "en";
  const user = await resolveAccount(headers, env, verifySession);
  const access = typeof accessOverride === "function" ? accessOverride : hasUnlimitedAccess;
  const unlimited = await access({ headers, payload, env, user });
  if (unlimited) {
    return { allowed: true, usage: { limited: false }, release: null };
  }
  if (!store) {
    return { allowed: true, usage: null, release: null };
  }

  const key = usageStorageKey(usageSubject(user, headers), usageSalt(env));
  const resetsOn = resetsOnIso(now);
  const month = monthKey(now);
  const explanationId = cleanExplanationId(payload?.explanationId) || randomUUID();

  let outcome;
  try {
    outcome = await commit(store, key, (raw) => decide(raw, month, explanationId));
  } catch (err) {
    if (err?.code === "usage_busy") {
      return {
        allowed: false,
        statusCode: 503,
        body: { error: t(lang, "errorGeneric"), code: "usage_busy" },
        release: null,
      };
    }
    throw err;
  }

  const usage = usageSnapshot(outcome.record, resetsOn);
  if (!outcome.allowed) {
    const closed = outcome.reason === "closed";
    return {
      allowed: false,
      statusCode: closed ? 400 : 402,
      body: {
        error: closed
          ? t(lang, "errorExplanationClosed")
          : t(lang, "freeLimitReached", { date: formatResetDate(resetsOn, lang) }),
        code: closed ? "explanation_closed" : "monthly_limit",
        usage,
      },
      release: null,
    };
  }

  return {
    allowed: true,
    usage,
    release: outcome.fresh
      ? () => releaseReservation(store, key, explanationId, month)
      : null,
  };
}

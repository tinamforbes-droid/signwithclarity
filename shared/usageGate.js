import { createHmac, randomUUID } from "node:crypto";
import { connectLambda, getStore } from "@netlify/blobs";

import { hasUnlimitedAccess, settlePaidUse } from "./access.js";
import { decideRelease } from "./entitlement.js";
import { isComparisonRequest } from "./comparePolicy.js";
import { asLanguage, t } from "./messages.js";
import { isGeneralCountry } from "./regions.js";
import { bearerToken, isUserId } from "./session.js";
import { verifySupabaseUser } from "./supabaseUser.js";
import {
  FREE_EXPLANATION_LIMIT,
  GENERAL_FREE_LIMIT,
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

/**
 * A v1 function does not receive the Blobs environment on its own.
 * Netlify puts it on the Lambda event, and connectLambda copies it
 * across. Headers are matched without caring about capital letters.
 */
export function attachBlobsEnvironment(event) {
  if (!event || typeof event.blobs !== "string" || !event.blobs) return false;
  const headers = {};
  for (const [key, value] of Object.entries(event.headers || {})) {
    const text = Array.isArray(value) ? value[0] : value;
    headers[String(key).toLowerCase()] = text == null ? "" : String(text);
  }
  connectLambda({ blobs: event.blobs, headers });
  return true;
}

function blobsContext() {
  const raw = process.env.NETLIFY_BLOBS_CONTEXT;
  if (!raw) return {};
  try {
    return JSON.parse(Buffer.from(raw, "base64").toString("utf8"));
  } catch {
    return {};
  }
}

/**
 * Strong reads need an uncached address. The Lambda payload only
 * includes the cached edge address, and asking for strong consistency
 * then throws. Use strong consistency when that address is present.
 */
function usageStoreOptions() {
  const context = blobsContext();
  const strong = Boolean(context.uncachedEdgeURL || (context.apiURL && !context.edgeURL));
  return strong ? { name: "swc-usage", consistency: "strong" } : { name: "swc-usage" };
}

function openNetlifyUsageStore(event) {
  try {
    attachBlobsEnvironment(event);
    return adaptBlobStore(getStore(usageStoreOptions()));
  } catch (err) {
    console.error(`swc blobs name=${err?.name || "Error"}`);
    const error = new Error("usage store unavailable");
    error.code = "usage_store";
    throw error;
  }
}

export async function resolveUsageStore(context, env = process.env, event) {
  if (context && Object.prototype.hasOwnProperty.call(context, "usageStore")) {
    return context.usageStore;
  }
  if (!isNetlifyRuntime(env)) return null;
  let opened;
  return {
    async get(key) {
      opened ??= openNetlifyUsageStore(event);
      return opened.get(key);
    },
    async compareAndSet(key, value, etag) {
      opened ??= openNetlifyUsageStore(event);
      return opened.compareAndSet(key, value, etag);
    },
  };
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

const ONCE_SCOPE = "once";

function currentOnceRecord(raw) {
  if (!raw || typeof raw !== "object" || raw.scope !== ONCE_SCOPE) {
    return { scope: ONCE_SCOPE, used: 0, explanations: {} };
  }
  const explanations = sanitizeExplanations(raw.explanations);
  return { scope: ONCE_SCOPE, used: Object.keys(explanations).length, explanations };
}

function decideOnce(raw, explanationId, continuing) {
  const record = currentOnceRecord(raw);
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
        scope: ONCE_SCOPE,
        explanations: { ...record.explanations, [explanationId]: calls + 1 },
        used: record.used,
      },
    };
  }
  if (continuing && record.used >= GENERAL_FREE_LIMIT) {
    return { write: false, allowed: true, fresh: false, record };
  }
  if (record.used >= GENERAL_FREE_LIMIT) {
    return { write: false, allowed: false, reason: "limit", fresh: false, record };
  }
  const explanations = { ...record.explanations, [explanationId]: 1 };
  return {
    write: true,
    allowed: true,
    fresh: true,
    record: { scope: ONCE_SCOPE, explanations, used: Object.keys(explanations).length },
  };
}

function onceSnapshot(records) {
  const list = records?.length ? records : [{ used: 0 }];
  const counts = list.map((record) => (
    Number.isInteger(record?.used) && record.used > 0 ? record.used : 0
  ));
  const used = Math.max(...counts);
  const atCap = list.some((record) => (record?.used || 0) >= GENERAL_FREE_LIMIT);
  return usageSnapshot(
    { used: atCap ? Math.max(used, GENERAL_FREE_LIMIT) : used },
    "",
    { once: true, limit: GENERAL_FREE_LIMIT },
  );
}

async function releaseOnce(store, key, explanationId) {
  try {
    await commit(store, key, (raw) => {
      const record = currentOnceRecord(raw);
      if (record.explanations[explanationId] !== 1) return { write: false, record };
      const explanations = { ...record.explanations };
      delete explanations[explanationId];
      return {
        write: true,
        record: { scope: ONCE_SCOPE, explanations, used: Object.keys(explanations).length },
      };
    });
  } catch {
    console.error("usage release failed");
  }
}

async function rollbackOnce(store, keys, explanationId) {
  for (const key of keys) await releaseOnce(store, key, explanationId);
}

/**
 * One free General explanation, shared by the account and the connection.
 * A later part of the same explanation still goes through. A new month does not.
 */
async function reserveOnce(store, keys, explanationId) {
  const seen = [];
  for (const key of keys) seen.push({ key, ...(await store.get(key)) });
  const continuing = seen.some((item) => (
    Number.isInteger(currentOnceRecord(item.value).explanations[explanationId])
  ));
  const fresh = [];
  const records = [];
  for (const item of seen) {
    let outcome;
    try {
      outcome = await commit(store, item.key, (raw) => decideOnce(raw, explanationId, continuing));
    } catch (err) {
      await rollbackOnce(store, fresh, explanationId);
      throw err;
    }
    if (!outcome.allowed) {
      await rollbackOnce(store, fresh, explanationId);
      return { allowed: false, reason: outcome.reason, records: [outcome.record] };
    }
    records.push(outcome.record);
    if (outcome.fresh) fresh.push(item.key);
  }
  return {
    allowed: true,
    records,
    release: fresh.length
      ? () => rollbackOnce(store, fresh, explanationId)
      : null,
  };
}

async function enforceOnceLimit({ store, user, headers, env, explanationId, lang }) {
  const subjects = generalUsageSubjects(user, headers);
  const keys = subjects.map((subject) => usageStorageKey(subject, usageSalt(env)));
  let outcome;
  try {
    outcome = await reserveOnce(store, keys, explanationId);
  } catch (err) {
    if (err?.code === "usage_busy" || err?.code === "usage_store") {
      return {
        allowed: false,
        statusCode: 503,
        body: { error: t(lang, "errorGeneric"), code: err.code },
        release: null,
      };
    }
    throw err;
  }
  const usage = onceSnapshot(outcome.records);
  if (!outcome.allowed) {
    const closed = outcome.reason === "closed";
    return {
      allowed: false,
      statusCode: closed ? 400 : 402,
      body: {
        error: closed ? t(lang, "errorExplanationClosed") : t(lang, "generalFreeUsed"),
        code: closed ? "explanation_closed" : "general_limit",
        usage,
      },
      release: null,
    };
  }
  return { allowed: true, usage, release: outcome.release };
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

/**
 * Who the one General free explanation belongs to.
 * The connection is always included. A signed-in account is included as well.
 * Using either one uses up the free try, so signing out or opening another
 * account on the same connection does not start it over.
 * The prefix keeps this record separate from the monthly Canada and US count.
 */
export function generalUsageSubjects(user, headers) {
  const subjects = [`once:${clientIp(headers)}`];
  const id = String(user?.id ?? "").trim().toLowerCase();
  if (isUserId(id)) subjects.unshift(`once:user:${id}`);
  return subjects;
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
  accountStore,
  fetchImpl,
  language = "en",
  country,
}) {
  const lang = asLanguage(language) || "en";
  const placeCountry = String(country ?? payload?.country ?? "Canada").trim() || "Canada";
  const user = await resolveAccount(headers, env, verifySession);
  if (payload?.mode === "release") {
    const explanationId = cleanExplanationId(payload?.comparisonId || payload?.explanationId);
    let released = false;
    if (user && explanationId && accountStore) {
      try {
        const result = await accountStore.update(user.id, (account) => {
          const outcome = decideRelease(account, explanationId);
          if (!outcome.restore) return { write: false };
          return { write: true, account: outcome.account };
        });
        released = Boolean(result?.written);
      } catch {
        console.error("comparison release failed");
      }
    }
    return { allowed: true, released, usage: null, release: null, finished: true };
  }
  const access = typeof accessOverride === "function" ? accessOverride : hasUnlimitedAccess;
  const unlimited = await access({ headers, payload, env, user });
  if (unlimited) {
    return { allowed: true, usage: { limited: false }, release: null };
  }

  const explanationId = cleanExplanationId(payload?.comparisonId || payload?.explanationId) || randomUUID();
  const comparing = isComparisonRequest(payload);
  if (user) {
    const paid = await settlePaidUse({
      user,
      env,
      explanationId,
      now,
      language: lang,
      purpose: comparing ? "compare" : "explain",
      accountStore,
      fetchImpl,
    });
    if (paid) return paid;
  }

  if (comparing) {
    return {
      allowed: false,
      statusCode: 402,
      body: { error: t(lang, "compareNeedsPlan"), code: "compare_needs_plan" },
      release: null,
    };
  }

  if (!store) {
    return { allowed: true, usage: null, release: null };
  }

  if (isGeneralCountry(placeCountry)) {
    return enforceOnceLimit({
      store,
      user,
      headers,
      env,
      explanationId,
      lang,
    });
  }

  const key = usageStorageKey(usageSubject(user, headers), usageSalt(env));
  const resetsOn = resetsOnIso(now);
  const month = monthKey(now);

  let outcome;
  try {
    outcome = await commit(store, key, (raw) => decide(raw, month, explanationId));
  } catch (err) {
    if (err?.code === "usage_busy" || err?.code === "usage_store") {
      return {
        allowed: false,
        statusCode: 503,
        body: { error: t(lang, "errorGeneric"), code: err.code },
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

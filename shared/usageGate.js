import { createHmac, randomUUID } from "node:crypto";
import { connectLambda, getStore } from "@netlify/blobs";

import { hasUnlimitedAccess, settlePaidUse } from "./access.js";
import { decideRelease } from "./entitlement.js";
import { isComparisonRequest } from "./comparePolicy.js";
import { asLanguage, t } from "./messages.js";
import { bearerToken, isUserId } from "./session.js";
import { verifySupabaseUser } from "./supabaseUser.js";
/**
 * Fallback salt for a stored key. A value in Netlify's environment
 * variables replaces this. The explanation path does not write a free count.
 */
export const BUILT_IN_USAGE_SALT = "signwithclarity-usage-v1";

const EXPLANATION_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

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
 * Allow a paid explanation, or refuse it before the model is called.
 * There is no free explanation. This function does not write a free-use
 * record, and it does not read the IP address to decide.
 */
export async function enforceUsageLimit({
  headers,
  payload,
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

  return {
    allowed: false,
    statusCode: 402,
    body: {
      error: t(lang, placeCountry === "Canada" ? "needsPlanCad" : "needsPlanUsd"),
      code: "needs_plan",
    },
    release: null,
  };
}

import { asLanguage, t } from "./messages.js";
import { bearerToken } from "./session.js";
import { verifySupabaseUser } from "./supabaseUser.js";

export function serverEnv(context) {
  if (context?.env && typeof context.env === "object") {
    return { ...process.env, ...context.env };
  }
  return process.env;
}

export function jsonReply(statusCode, payload) {
  return {
    statusCode,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  };
}

export function readJson(event) {
  try {
    return JSON.parse(event?.body || "{}");
  } catch {
    return null;
  }
}

export async function signedInUser(event, context) {
  const env = serverEnv(context);
  const token = bearerToken(event?.headers);
  if (!token) return { env, user: null };
  const verify = typeof context?.verifySession === "function" ? context.verifySession : verifySupabaseUser;
  try {
    const user = await verify({
      token,
      env,
      fetchImpl: context?.fetchImpl || globalThis.fetch,
    });
    return { env, user: user?.id ? user : null };
  } catch {
    console.error("session check failed");
    return { env, user: null };
  }
}

export function languageFrom(payload) {
  return asLanguage(payload?.language) || "en";
}

export function failure(lang, statusCode, key, code) {
  return jsonReply(statusCode, { error: t(lang, key), code });
}

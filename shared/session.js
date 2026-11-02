/**
 * Browser-safe helpers for optional email sign-in.
 * The secret key is not read here. The server checks the session in
 * shared/supabaseUser.js.
 */

const USER_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ACCESS_TOKEN = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/;

export function normalizeEmail(value) {
  return String(value ?? "").trim().toLowerCase();
}

export function isPlausibleEmail(value) {
  const email = normalizeEmail(value);
  if (!email || email.length > 320) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/** A Supabase access token is a JWT. Anything else is ignored. */
export function isAccessToken(value) {
  const token = String(value ?? "").trim();
  if (token.length < 20 || token.length > 8192) return false;
  return ACCESS_TOKEN.test(token);
}

export function isUserId(value) {
  return USER_ID.test(String(value ?? "").trim());
}

/** The browser key starts with sb_publishable_. A secret key must not be used here. */
export function isBrowserPublishableKey(value) {
  return String(value ?? "").trim().startsWith("sb_publishable_");
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

/** The session token from the Authorization header. Never from the body. */
export function bearerToken(headers) {
  const raw = headerValue(headers, "authorization").trim();
  const match = /^Bearer\s+(\S+)$/i.exec(raw);
  if (!match) return "";
  return isAccessToken(match[1]) ? match[1] : "";
}

export function supabaseProjectUrl(env) {
  const raw = String(env?.SUPABASE_URL || env?.VITE_SUPABASE_URL || "").trim();
  let url;
  try {
    url = new URL(raw);
  } catch {
    return "";
  }
  if (url.protocol !== "https:") return "";
  if (url.username || url.password || url.search || url.hash) return "";
  if (url.pathname !== "/" && url.pathname !== "") return "";
  return url.origin;
}

/**
 * Where the email link may send the person back. Supabase still has to
 * allow that address. Local http is only localhost, so a pasted page
 * cannot aim the link at another site.
 */
export function signInRedirectUrl(origin) {
  let url;
  try {
    url = new URL(String(origin || ""));
  } catch {
    return "";
  }
  if (url.username || url.password) return "";
  if (url.protocol === "https:") return `${url.origin}/`;
  const local = url.hostname === "localhost" || url.hostname === "127.0.0.1";
  if (url.protocol === "http:" && local) return `${url.origin}/`;
  return "";
}

/**
 * The only fields the browser sends to ask for a sign-in link.
 * There is no password, and there is no document.
 */
export function magicLinkRequest(email, origin) {
  const clean = normalizeEmail(email);
  const redirect = signInRedirectUrl(origin);
  const options = { shouldCreateUser: true };
  if (redirect) options.emailRedirectTo = redirect;
  return { email: clean, options };
}

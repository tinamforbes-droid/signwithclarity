import { isAccessToken, isUserId, normalizeEmail, supabaseProjectUrl } from "./session.js";

function secretKey(env) {
  return String(env?.SUPABASE_SECRET_KEY || "").trim();
}

/**
 * Ask Supabase who this session belongs to.
 * The secret key stays on the server. A user id in the request body is
 * never read. The document is not sent.
 */
export async function verifySupabaseUser({ token, env, fetchImpl = fetch } = {}) {
  const accessToken = isAccessToken(token) ? String(token).trim() : "";
  if (!accessToken) return null;

  const url = supabaseProjectUrl(env);
  const secret = secretKey(env);
  if (!url || !secret.startsWith("sb_secret_")) {
    console.error("session check skipped: SUPABASE_SECRET_KEY is not set");
    return null;
  }

  const response = await fetchImpl(`${url}/auth/v1/user`, {
    method: "GET",
    headers: {
      apikey: secret,
      Authorization: `Bearer ${accessToken}`,
    },
  });
  if (!response.ok) return null;

  let data;
  try {
    data = await response.json();
  } catch {
    return null;
  }

  const id = String(data?.id || data?.user?.id || "").trim();
  if (!isUserId(id)) return null;
  const email = normalizeEmail(data?.email || data?.user?.email || "");
  return { id: id.toLowerCase(), email };
}

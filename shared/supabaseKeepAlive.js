import { supabaseProjectUrl } from "./session.js";

function secretKey(env) {
  const secret = String(env?.SUPABASE_SECRET_KEY || "").trim();
  return secret.startsWith("sb_secret_") ? secret : "";
}

/**
 * Read at most one value from the accounts table, through the database API.
 * Supabase only counts a project as active when Postgres runs a query.
 * The sign-in health check does not do that, so this does not call it.
 * The value itself is discarded. An empty table still counts.
 */
export async function pingSupabaseDatabase({ env, fetchImpl = fetch } = {}) {
  const origin = supabaseProjectUrl(env);
  const secret = secretKey(env);
  if (!origin || !secret) {
    return { ok: false, reason: "missing_config" };
  }

  const url = new URL("/rest/v1/accounts", origin);
  url.searchParams.set("select", "paid");
  url.searchParams.set("limit", "1");

  let response;
  try {
    response = await fetchImpl(url.toString(), {
      method: "GET",
      redirect: "error",
      headers: {
        apikey: secret,
        Authorization: `Bearer ${secret}`,
        Accept: "application/json",
        "Cache-Control": "no-cache",
      },
    });
  } catch {
    return { ok: false, reason: "request_failed" };
  }

  const status = Number(response?.status) || 0;
  if (!response?.ok) {
    return { ok: false, reason: "http_error", status };
  }

  let data;
  try {
    data = typeof response.json === "function" ? await response.json() : null;
  } catch {
    return { ok: false, reason: "not_a_query", status };
  }
  if (!Array.isArray(data)) {
    return { ok: false, reason: "not_a_query", status };
  }
  return { ok: true, status, rows: data.length > 0 ? 1 : 0 };
}

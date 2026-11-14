// Netlify runs this on the schedule in netlify.toml.
// It reads one value from the accounts table so the free Supabase
// project does not look unused. The website never calls this function.

import { pingSupabaseDatabase } from "../../shared/supabaseKeepAlive.js";

function serverEnv(context) {
  if (context?.env && typeof context.env === "object") {
    return { ...process.env, ...context.env };
  }
  return process.env;
}

async function nextRun(req) {
  try {
    const body = typeof req?.json === "function"
      ? await req.json()
      : JSON.parse(req?.body || "{}");
    const value = String(body?.next_run || "");
    return /^\d{4}-\d{2}-\d{2}T/.test(value) ? value : "";
  } catch {
    return "";
  }
}

function line(...parts) {
  return parts
    .filter((part) => part !== "" && part != null)
    .join(" ")
    .replace(/sb_secret_[A-Za-z0-9_-]*/g, "[secret]")
    .replace(/sb_publishable_[A-Za-z0-9_-]*/g, "[secret]");
}

const FAILURE = {
  missing_config: "The Supabase address or secret key is missing.",
  request_failed: "The request did not reach the database.",
  http_error: "The database did not answer.",
  not_a_query: "The reply was not a database result.",
};

export default async function supabaseKeepAlive(req, context) {
  const upcoming = await nextRun(req);
  const result = await pingSupabaseDatabase({
    env: serverEnv(context),
    fetchImpl: context?.fetchImpl || globalThis.fetch,
  });
  if (!result.ok) {
    const detail = FAILURE[result.reason] || "The database did not answer.";
    const withStatus = result.status
      ? `${detail.replace(/\.$/, "")} (HTTP ${result.status}).`
      : detail;
    console.error(line("supabase keep-alive failed.", withStatus));
    throw new Error("supabase keep-alive failed");
  }
  console.log(line(
    "supabase keep-alive ok.",
    `The database answered (${result.rows} ${result.rows === 1 ? "row" : "rows"}).`,
    upcoming ? `Next run: ${upcoming}` : "",
  ));
}

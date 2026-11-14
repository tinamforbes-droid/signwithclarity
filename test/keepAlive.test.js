import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import supabaseKeepAlive from "../netlify/functions/supabase-keep-alive.js";
import { pingSupabaseDatabase } from "../shared/supabaseKeepAlive.js";

const SECRET = "sb_secret_server";
const PUBLISHABLE = "sb_publishable_browser";
const EMAIL = "ada@example.com";
const ORIGIN = "https://ldhkqqhlztsaljccazti.supabase.co";

function env(extra = {}) {
  return {
    VITE_SUPABASE_URL: ORIGIN,
    VITE_SUPABASE_PUBLISHABLE_KEY: PUBLISHABLE,
    SUPABASE_SECRET_KEY: SECRET,
    ...extra,
  };
}

function jsonResponse(status, body) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  };
}

async function capture(run) {
  const logs = [];
  const originalLog = console.log;
  const originalError = console.error;
  console.log = (...args) => logs.push(args.map(String).join(" "));
  console.error = (...args) => logs.push(args.map(String).join(" "));
  try {
    await run();
  } finally {
    console.log = originalLog;
    console.error = originalError;
  }
  return logs.join("\n");
}

test("the keep-alive reads one accounts value through the database API", async () => {
  let seen;
  const result = await pingSupabaseDatabase({
    env: env(),
    fetchImpl: async (url, options) => {
      seen = { url: String(url), ...options };
      return jsonResponse(200, [{ paid: false, email: EMAIL }]);
    },
  });

  assert.deepEqual(result, { ok: true, status: 200, rows: 1 });
  assert.equal(seen.method, "GET");
  assert.equal(seen.redirect, "error");
  assert.equal(seen.body, undefined);
  assert.equal(seen.url, `${ORIGIN}/rest/v1/accounts?select=paid&limit=1`);
  assert.equal(seen.url.includes("/auth/"), false);
  assert.equal(seen.headers.apikey, SECRET);
  assert.equal(seen.headers.Authorization, `Bearer ${SECRET}`);
  assert.equal(JSON.stringify(seen).includes(PUBLISHABLE), false);
  assert.equal(JSON.stringify(result).includes(EMAIL), false);
  assert.equal(JSON.stringify(result).includes(SECRET), false);

  const empty = await pingSupabaseDatabase({
    env: { SUPABASE_URL: `${ORIGIN}/`, SUPABASE_SECRET_KEY: SECRET },
    fetchImpl: async () => jsonResponse(200, []),
  });
  assert.deepEqual(empty, { ok: true, status: 200, rows: 0 });
});

test("a keep-alive that does not get a database result fails closed", async () => {
  const paused = await pingSupabaseDatabase({
    env: env(),
    fetchImpl: async () => jsonResponse(540, { message: "Project is paused" }),
  });
  assert.deepEqual(paused, { ok: false, reason: "http_error", status: 540 });

  const page = await pingSupabaseDatabase({
    env: env(),
    fetchImpl: async () => ({
      ok: true,
      status: 200,
      json: async () => {
        throw new Error("not json");
      },
    }),
  });
  assert.deepEqual(page, { ok: false, reason: "not_a_query", status: 200 });

  const objectBody = await pingSupabaseDatabase({
    env: env(),
    fetchImpl: async () => jsonResponse(200, { paid: false }),
  });
  assert.equal(objectBody.ok, false);
  assert.equal(objectBody.reason, "not_a_query");

  let called = false;
  const missing = await pingSupabaseDatabase({
    env: { VITE_SUPABASE_URL: ORIGIN, SUPABASE_SECRET_KEY: PUBLISHABLE },
    fetchImpl: async () => {
      called = true;
      return jsonResponse(200, []);
    },
  });
  assert.deepEqual(missing, { ok: false, reason: "missing_config" });
  assert.equal(called, false);

  const dropped = await pingSupabaseDatabase({
    env: env(),
    fetchImpl: async () => {
      throw new Error(`connect failed for ${SECRET}`);
    },
  });
  assert.deepEqual(dropped, { ok: false, reason: "request_failed" });
  assert.equal(JSON.stringify(dropped).includes(SECRET), false);
});

test("the scheduled function logs the outcome and never the key or the row", async () => {
  const seen = [];
  const okLog = await capture(async () => {
    await supabaseKeepAlive(new Request("https://internal.test/", {
      method: "POST",
      body: JSON.stringify({ next_run: "2026-11-15T15:17:00.000Z" }),
    }), {
      env: env(),
      fetchImpl: async (url) => {
        seen.push(String(url));
        return jsonResponse(200, [{ paid: true, email: EMAIL, note: SECRET }]);
      },
    });
  });
  assert.equal(seen.length, 1);
  assert.match(seen[0], /\/rest\/v1\/accounts\?select=paid&limit=1$/);
  assert.equal(okLog, "supabase keep-alive ok. The database answered (1 row). Next run: 2026-11-15T15:17:00.000Z");
  assert.equal(okLog.includes(SECRET), false);
  assert.equal(okLog.includes(EMAIL), false);
  assert.equal(okLog.includes(PUBLISHABLE), false);

  let failed;
  const failLog = await capture(async () => {
    try {
      await supabaseKeepAlive(new Request("https://internal.test/", {
        method: "POST",
        body: JSON.stringify({ next_run: "not-a-time", leak: SECRET }),
      }), {
        env: env(),
        fetchImpl: async () => jsonResponse(503, { message: SECRET }),
      });
    } catch (err) {
      failed = err;
    }
  });
  assert.equal(failed?.message, "supabase keep-alive failed");
  assert.equal(failLog, "supabase keep-alive failed. The database did not answer (HTTP 503).");
  assert.equal(failLog.includes(SECRET), false);

  let fetched = false;
  const missingLog = await capture(async () => {
    await assert.rejects(
      () => supabaseKeepAlive({}, {
        env: { SUPABASE_SECRET_KEY: "", SUPABASE_URL: "", VITE_SUPABASE_URL: "" },
        fetchImpl: async () => {
          fetched = true;
          return jsonResponse(200, []);
        },
      }),
      /supabase keep-alive failed/,
    );
  });
  assert.equal(fetched, false);
  assert.match(missingLog, /secret key is missing/);
  assert.equal(missingLog.includes("sb_secret_"), false);
});

test("the keep-alive is scheduled once a day and is not a public page", () => {
  const toml = readFileSync("netlify.toml", "utf8");
  assert.match(toml, /\[functions\."supabase-keep-alive"\]\s+schedule = "17 15 \* \* \*"/);
  const source = readFileSync("netlify/functions/supabase-keep-alive.js", "utf8");
  assert.equal(source.includes("export async function handler"), false);
  assert.equal(source.includes("/auth/v1"), false);
  assert.equal(source.includes(SECRET), false);
});

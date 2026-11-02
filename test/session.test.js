import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { postDecode } from "../shared/decodeRun.js";
import { hasUnlimitedAccess } from "../shared/access.js";
import {
  bearerToken,
  isBrowserPublishableKey,
  isPlausibleEmail,
  magicLinkRequest,
  signInRedirectUrl,
} from "../shared/session.js";
import { verifySupabaseUser } from "../shared/supabaseUser.js";
import { handler } from "../netlify/functions/decode.js";
import { createMemoryUsageStore } from "../shared/usageGate.js";

const MARKER = "POLICY_SECRET_MARKER_do_not_store";
const USER_ID = "11111111-1111-4111-8111-111111111111";
const TOKEN = "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1c2VyIn0.signature";

test("the sign-in link asks only for an email, and the redirect stays on this site", () => {
  assert.equal(isPlausibleEmail("  Ada@Example.com "), true);
  assert.equal(isPlausibleEmail("not an email"), false);
  assert.equal(isPlausibleEmail("ada@example.com\nBcc: someone"), false);

  const request = magicLinkRequest("  Ada@Example.com ", "https://deploy-preview--signwithclarity.netlify.app/privacy");
  assert.deepEqual(request, {
    email: "ada@example.com",
    options: {
      shouldCreateUser: true,
      emailRedirectTo: "https://deploy-preview--signwithclarity.netlify.app/",
    },
  });
  assert.equal(JSON.stringify(request).includes("password"), false);
  assert.equal(JSON.stringify(request).includes(MARKER), false);
  assert.equal(signInRedirectUrl("http://localhost:5173/page"), "http://localhost:5173/");
  assert.equal(signInRedirectUrl("http://127.0.0.1:4173"), "http://127.0.0.1:4173/");
  assert.equal(signInRedirectUrl("http://example.com"), "");
  assert.equal(signInRedirectUrl("javascript:alert(1)"), "");
});

test("the browser key is the publishable key, and the session token comes from the header", () => {
  assert.equal(isBrowserPublishableKey("sb_publishable_example"), true);
  assert.equal(isBrowserPublishableKey("sb_secret_example"), false);
  assert.equal(isBrowserPublishableKey(""), false);
  assert.equal(bearerToken({ Authorization: `Bearer ${TOKEN}` }), TOKEN);
  assert.equal(bearerToken({ authorization: "Bearer not a token" }), "");
  assert.equal(bearerToken({ "x-user-id": USER_ID }), "");
});

test("the server checks the session with the secret key and does not send the document", async () => {
  let calls = 0;
  const user = await verifySupabaseUser({
    token: TOKEN,
    env: {
      VITE_SUPABASE_URL: "https://ldhkqqhlztsaljccazti.supabase.co",
      VITE_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_browser",
      SUPABASE_SECRET_KEY: "sb_secret_server",
    },
    fetchImpl: async (url, options) => {
      calls += 1;
      assert.equal(url, "https://ldhkqqhlztsaljccazti.supabase.co/auth/v1/user");
      assert.equal(options.method, "GET");
      assert.equal(options.body, undefined);
      assert.equal(options.headers.apikey, "sb_secret_server");
      assert.equal(options.headers.Authorization, `Bearer ${TOKEN}`);
      assert.equal(JSON.stringify(options).includes(MARKER), false);
      assert.equal(JSON.stringify(options).includes("sb_publishable_browser"), false);
      return {
        ok: true,
        json: async () => ({ id: USER_ID.toUpperCase(), email: "ada@example.com" }),
      };
    },
  });
  assert.equal(calls, 1);
  assert.deepEqual(user, { id: USER_ID });

  const wrapped = await verifySupabaseUser({
    token: TOKEN,
    env: { SUPABASE_URL: "https://ldhkqqhlztsaljccazti.supabase.co/", SUPABASE_SECRET_KEY: "sb_secret_server" },
    fetchImpl: async () => ({ ok: true, json: async () => ({ user: { id: USER_ID } }) }),
  });
  assert.deepEqual(wrapped, { id: USER_ID });

  const rejected = await verifySupabaseUser({
    token: TOKEN,
    env: { VITE_SUPABASE_URL: "https://ldhkqqhlztsaljccazti.supabase.co", SUPABASE_SECRET_KEY: "sb_secret_server" },
    fetchImpl: async () => ({ ok: false, status: 401, json: async () => ({ message: "bad" }) }),
  });
  assert.equal(rejected, null);

  let fetched = false;
  const missing = await verifySupabaseUser({
    token: TOKEN,
    env: { VITE_SUPABASE_URL: "https://ldhkqqhlztsaljccazti.supabase.co", SUPABASE_SECRET_KEY: "sb_publishable_browser" },
    fetchImpl: async () => {
      fetched = true;
      return { ok: true, json: async () => ({ id: USER_ID }) };
    },
  });
  assert.equal(missing, null);
  assert.equal(fetched, false);
  assert.equal(await verifySupabaseUser({ token: "", env: { SUPABASE_SECRET_KEY: "sb_secret_server" } }), null);
});

test("the decode function verifies the session before it counts, and still refuses a paid flag", async (t) => {
  const previousKey = process.env.ANTHROPIC_API_KEY;
  process.env.ANTHROPIC_API_KEY = "test-key";
  t.after(() => {
    if (previousKey === undefined) delete process.env.ANTHROPIC_API_KEY;
    else process.env.ANTHROPIC_API_KEY = previousKey;
  });

  const seen = [];
  const original = globalThis.fetch;
  globalThis.fetch = async (url, options = {}) => {
    seen.push({ url: String(url), method: options.method, headers: options.headers, body: options.body });
    if (String(url).includes("/auth/v1/user")) {
      return { ok: true, json: async () => ({ id: USER_ID, email: "ada@example.com" }) };
    }
    return {
      ok: true,
      status: 200,
      text: async () => JSON.stringify({
        content: [{ text: JSON.stringify({
          summary: "A short summary.",
          flags: "• Nothing surprising.",
          questions: "• What is my deductible?",
          terms: "Deductible: the amount you pay first.",
        }) }],
      }),
    };
  };
  t.after(() => {
    globalThis.fetch = original;
  });

  const store = createMemoryUsageStore();
  const response = await handler({
    httpMethod: "POST",
    headers: {
      "x-nf-client-connection-ip": "203.0.113.10",
      authorization: `Bearer ${TOKEN}`,
    },
    body: JSON.stringify({
      mode: "single",
      docText: `A short hail clause. ${MARKER}`,
      language: "en",
      country: "Canada",
      region: "Alberta",
      userId: "99999999-9999-4999-8999-999999999999",
      paid: true,
      unlimited: true,
    }),
  }, {
    usageStore: store,
    env: {
      VITE_SUPABASE_URL: "https://ldhkqqhlztsaljccazti.supabase.co",
      VITE_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_browser",
      SUPABASE_SECRET_KEY: "sb_secret_server",
    },
  });

  assert.equal(response.statusCode, 200);
  assert.equal(JSON.parse(response.body).usage.limited, true);
  assert.equal(JSON.parse(response.body).usage.used, 1);
  assert.equal(await hasUnlimitedAccess({ user: { id: USER_ID }, payload: { paid: true } }), false);

  const supabaseCall = seen.find((call) => call.url.includes("/auth/v1/user"));
  const modelCall = seen.find((call) => call.url.includes("anthropic.com"));
  assert.equal(supabaseCall.headers.apikey, "sb_secret_server");
  assert.equal(supabaseCall.headers.Authorization, `Bearer ${TOKEN}`);
  assert.equal(supabaseCall.body, undefined);
  assert.equal(JSON.stringify(supabaseCall).includes(MARKER), false);
  assert.equal(JSON.stringify(modelCall.body).includes(TOKEN), false);
  assert.equal(JSON.stringify(modelCall.body).includes("sb_secret_server"), false);
  assert.equal(JSON.stringify(modelCall.body).includes("ada@example.com"), false);
  const dumped = JSON.stringify(store.snapshot());
  assert.equal(dumped.includes(MARKER), false);
  assert.equal(dumped.includes(USER_ID), false);
  assert.equal(dumped.includes("ada@example.com"), false);
});

test("the explanation request carries the session in a header, not in the document body", async () => {
  let seen;
  const text = await postDecode(
    { docText: `clause ${MARKER}`, userId: "nope" },
    {
      accessToken: async () => TOKEN,
      fetchImpl: async (_url, options) => {
        seen = options;
        return { ok: true, status: 200, text: async () => JSON.stringify({ text: "ok" }) };
      },
    },
  );
  assert.equal(text, "ok");
  assert.equal(seen.headers.Authorization, `Bearer ${TOKEN}`);
  const body = JSON.parse(seen.body);
  assert.equal(body.docText, `clause ${MARKER}`);
  assert.equal(body.userId, "nope");
  assert.equal(JSON.stringify(body).includes(TOKEN), false);

  let without;
  await postDecode({ docText: "still here" }, {
    accessToken: async () => {
      throw new Error("session lookup failed");
    },
    fetchImpl: async (_url, options) => {
      without = options;
      return { ok: true, status: 200, text: async () => JSON.stringify({ text: "ok" }) };
    },
  });
  assert.equal(without.headers.Authorization, undefined);
  assert.equal(JSON.parse(without.body).docText, "still here");
});

test("the page source does not contain the server secret", () => {
  const browserFiles = [
    "src/authClient.js",
    "src/AccountBar.jsx",
    "src/SignWithClarity.jsx",
    "shared/decodeRun.js",
    "shared/session.js",
    "shared/messages.js",
  ];
  for (const file of browserFiles) {
    const text = readFileSync(file, "utf8");
    assert.equal(text.includes("SUPABASE_SECRET_KEY"), false, file);
    assert.equal(text.includes("sb_secret_"), false, file);
  }
  assert.equal(readFileSync("shared/supabaseUser.js", "utf8").includes("SUPABASE_SECRET_KEY"), true);
});

test("the accounts table records paid as false and does not store a document", () => {
  const sql = readFileSync("supabase/migrations/20261102190000_accounts.sql", "utf8");
  assert.match(sql, /create table if not exists public\.accounts/i);
  assert.match(sql, /paid boolean not null default false/i);
  assert.match(sql, /enable row level security/i);
  assert.match(sql, /for select/i);
  assert.match(sql, /auth\.uid\(\) = user_id/);
  assert.match(sql, /grant select on table public\.accounts to authenticated/i);
  assert.match(sql, /values \(new\.id, new\.email, false\)/);
  assert.equal(/for (insert|update|delete)/i.test(sql), false);
  assert.equal(/grant (all|insert|update|delete)[^;]*to authenticated/i.test(sql), false);
  const table = sql.slice(sql.toLowerCase().indexOf("create table"), sql.indexOf(");"));
  assert.match(table, /user_id/);
  assert.match(table, /email/);
  assert.match(table, /paid/);
  assert.equal(/doc|note|explanation|policy|password/i.test(table), false);
});

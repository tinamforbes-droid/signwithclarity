import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";

import { createMemoryAccountStore } from "../shared/accountStore.js";
import { DecodeError, postDecode, runDecode } from "../shared/decodeRun.js";
import { hasUnlimitedAccess } from "../shared/access.js";
import { buildSamplePolicy } from "../shared/samplePolicy.js";
import {
  formatResetDate,
  monthKey,
  resetsOnIso,
  usageStatusMessage,
} from "../shared/usageCopy.js";
import {
  adaptBlobStore,
  cleanExplanationId,
  clientIp,
  createMemoryUsageStore,
  isNetlifyRuntime,
  resolveUsageStore,
  usageSalt,
  usageStorageKey,
} from "../shared/usageGate.js";
import { handler } from "../netlify/functions/decode.js";

const MARKER = "POLICY_SECRET_MARKER_do_not_store";
const IP = "203.0.113.10";

function sections() {
  return JSON.stringify({
    summary: "A short summary.",
    flags: "• Nothing surprising.",
    questions: "• What is my deductible?",
    terms: "Deductible: the amount you pay first.",
  });
}

function mockAnthropic(status = 200, text = sections()) {
  const calls = [];
  const original = globalThis.fetch;
  globalThis.fetch = async (url, options) => {
    calls.push({ url, body: JSON.parse(options.body) });
    return {
      ok: status >= 200 && status < 300,
      status,
      text: async () => JSON.stringify(
        status === 200 ? { content: [{ text }] } : { error: { type: "server" } },
      ),
    };
  };
  return {
    calls,
    restore() {
      globalThis.fetch = original;
    },
  };
}

function eventFor({
  ip = IP,
  id = randomUUID(),
  language = "en",
  doc = `A short hail clause. ${MARKER}`,
  mode = "single",
  notes,
  headers,
  extra = {},
} = {}) {
  return {
    httpMethod: "POST",
    headers: headers || { "x-nf-client-connection-ip": ip },
    body: JSON.stringify({
      mode,
      docText: doc,
      notes,
      language,
      country: "Canada",
      region: "Alberta",
      explanationId: id,
      ...extra,
    }),
  };
}

function contextFor(store, extra = {}) {
  return { usageStore: store, ...extra };
}


test("reset dates stay available for a yearly plan, and a free count is not offered", () => {
  const midMonth = new Date("2026-11-15T23:30:00Z");
  assert.equal(monthKey(midMonth), "2026-11");
  assert.equal(resetsOnIso(midMonth), "2026-12-01");
  assert.equal(resetsOnIso(new Date("2026-12-31T23:59:00Z")), "2027-01-01");
  assert.match(formatResetDate("2026-12-01", "en"), /December/);
  assert.match(formatResetDate("2026-12-01", "fr"), /décembre/);
  assert.match(formatResetDate("2026-12-01", "es"), /diciembre/);

  const leftover = { limited: true, remaining: 2, resetsOn: "2026-12-01" };
  assert.match(usageStatusMessage("en", leftover), /no free explanation/i);
  assert.match(usageStatusMessage("fr", { ...leftover, remaining: 1 }), /pas d'explication gratuite/);
  assert.match(usageStatusMessage("es", { ...leftover, remaining: 0 }), /explicación gratuita/);
  assert.match(usageStatusMessage("es", leftover), /de pago/);
  assert.equal(usageStatusMessage("en", { limited: false }), "");
  assert.match(usageStatusMessage("en", {
    limited: true,
    plan: "yearly",
    remaining: 4,
    resetsOn: "2027-01-01",
  }), /4 explanations left/);
});

test("the storage key is a salted hash, and a forwarded header cannot pick a new one", () => {
  const key = usageStorageKey(IP, usageSalt({}));
  assert.match(key, /^[0-9a-f]{64}$/);
  assert.equal(key.includes(IP), false);
  assert.notEqual(key, usageStorageKey(IP, "another-salt"));
  assert.equal(usageSalt({ USAGE_HASH_SALT: "  site-salt  " }), "site-salt");

  const headers = {
    "X-NF-Client-Connection-IP": IP,
    "x-forwarded-for": "198.51.100.8, 203.0.113.10",
  };
  assert.equal(clientIp(headers), IP);
  assert.equal(clientIp({ "X-Forwarded-For": "198.51.100.8" }), "unknown");
  assert.equal(clientIp({ "client-ip": "192.0.2.4" }), "192.0.2.4");
  assert.equal(cleanExplanationId("not-a-uuid"), "");
  const id = randomUUID();
  assert.equal(cleanExplanationId(id.toUpperCase()), id);
  assert.equal(cleanExplanationId(id), id);

  assert.equal(isNetlifyRuntime({}), false);
  assert.equal(isNetlifyRuntime({ NETLIFY: "true" }), true);
  assert.equal(isNetlifyRuntime({ AWS_LAMBDA_FUNCTION_NAME: "fn" }), true);
});

test("outside Netlify, tests do not open the blob store", async () => {
  assert.equal(await resolveUsageStore(undefined, {}), null);
  assert.equal(await resolveUsageStore({}, { NETLIFY: "" }), null);
  const passed = createMemoryUsageStore();
  assert.equal(await resolveUsageStore({ usageStore: passed }, { NETLIFY: "true" }), passed);
});

test("a paid comparison does not need blobs, and an unpaid explanation does not open them", async (t) => {
  process.env.ANTHROPIC_API_KEY = "test-key";
  const previousBlobs = process.env.NETLIFY_BLOBS_CONTEXT;
  const original = globalThis.fetch;
  const urls = [];
  globalThis.fetch = async (url, options = {}) => {
    const address = String(url);
    urls.push(address);
    if (address.includes("api.anthropic.com")) {
      return {
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ content: [{ text: sections() }] }),
      };
    }
    const method = String(options.method || "get").toLowerCase();
    return {
      status: method === "put" ? 200 : 404,
      ok: method === "put",
      headers: { get: () => null },
      body: null,
    };
  };
  t.after(() => {
    globalThis.fetch = original;
    if (previousBlobs === undefined) delete process.env.NETLIFY_BLOBS_CONTEXT;
    else process.env.NETLIFY_BLOBS_CONTEXT = previousBlobs;
  });

  const user = "11111111-1111-4111-8111-111111111111";
  const accounts = createMemoryAccountStore({
    [user]: { paid: true, plan: "household", credits_remaining: 0, checks_remaining: 1 },
  });
  const paid = await handler({
    httpMethod: "POST",
    headers: { authorization: "Bearer eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1c2VyIn0.signature" },
    body: JSON.stringify({
      mode: "compare",
      language: "en",
      country: "Canada",
      region: "British Columbia",
      explanationId: randomUUID(),
      policies: [
        { label: "Westland", notes: "Named insured. Liability one million. Deductible five hundred." },
        { label: "Car", notes: "Named insured. Collision deductible seven hundred. Liability one million." },
      ],
    }),
  }, {
    env: { NETLIFY: "true" },
    now: new Date("2026-11-02T15:00:00Z"),
    accountStore: accounts,
    verifySession: async () => ({ id: user, email: "ada@example.com" }),
  });
  assert.equal(paid.statusCode, 200, paid.body);
  assert.equal(accounts.snapshot()[user].checks_remaining, 0);
  assert.equal(urls.some((url) => url.includes("api.anthropic.com")), true);
  assert.equal(urls.some((url) => url.includes("edge.example")), false);

  urls.length = 0;
  const unpaid = await handler({
    httpMethod: "POST",
    headers: {
      "X-Nf-Site-Id": "9a003659-aaaa-0000-aaaa-63d3720d8621",
      "X-Nf-Deploy-Id": "deploy-1",
      "x-nf-client-connection-ip": IP,
    },
    blobs: Buffer.from(JSON.stringify({
      url: "https://edge.example",
      token: "edge-token",
    })).toString("base64"),
    body: JSON.stringify({
      mode: "single",
      docText: `A short hail clause. ${MARKER}`,
      language: "en",
      country: "Canada",
      region: "Alberta",
      explanationId: randomUUID(),
      paid: true,
      unlimited: true,
    }),
  }, { env: { NETLIFY: "true" } });
  assert.equal(unpaid.statusCode, 402, unpaid.body);
  assert.equal(JSON.parse(unpaid.body).code, "needs_plan");
  assert.match(JSON.parse(unpaid.body).error, /\$9 CAD/);
  assert.equal(urls.some((url) => url.includes("edge.example")), false);
  assert.equal(urls.some((url) => url.includes("api.anthropic.com")), false);
});

test("a signed-in or paid flag in the body is not unlimited", async () => {
  assert.equal(await hasUnlimitedAccess({ payload: { unlimited: true, paid: true } }), false);
});

test("an unpaid explanation is refused, and the document is not stored", async (t) => {
  process.env.ANTHROPIC_API_KEY = "test-key";
  const anthropic = mockAnthropic();
  t.after(() => anthropic.restore());
  const store = createMemoryUsageStore();
  const now = new Date("2026-11-02T15:00:00Z");

  for (const country of ["Canada", "United States"]) {
    const response = await handler(eventFor({ extra: { country, region: country === "Canada" ? "Alberta" : "Texas" } }), contextFor(store, { now }));
    assert.equal(response.statusCode, 402, country);
    assert.equal(JSON.parse(response.body).code, "needs_plan");
  }
  const french = await handler(eventFor({ language: "fr" }), contextFor(store, { now }));
  assert.match(JSON.parse(french.body).error, /explication gratuite/);
  const spanish = await handler(eventFor({ language: "es", extra: { country: "United States", region: "Texas" } }), contextFor(store, { now }));
  assert.match(JSON.parse(spanish.body).error, /US\$9/);
  assert.match(JSON.parse(spanish.body).error, /explicación gratuita/);
  assert.equal(anthropic.calls.length, 0);
  assert.deepEqual(store.snapshot(), {});

  const responses = await Promise.all(
    Array.from({ length: 8 }, () => handler(eventFor(), contextFor(store, { now }))),
  );
  assert.equal(responses.every((response) => response.statusCode === 402), true);
  assert.equal(anthropic.calls.length, 0);
});

test("an unlimited access hook skips the paywall, and a body flag does not", async (t) => {
  process.env.ANTHROPIC_API_KEY = "test-key";
  const anthropic = mockAnthropic();
  t.after(() => anthropic.restore());
  const store = createMemoryUsageStore();
  for (let n = 0; n < 3; n++) {
    const response = await handler(eventFor({ extra: { unlimited: true } }), contextFor(store, {
      hasUnlimitedAccess: async () => true,
    }));
    assert.equal(response.statusCode, 200);
    assert.equal(JSON.parse(response.body).usage.limited, false);
  }
  const blocked = await handler(eventFor({ extra: { unlimited: true, paid: true } }), contextFor(store));
  assert.equal(blocked.statusCode, 402);
  assert.deepEqual(store.snapshot(), {});
  assert.equal(anthropic.calls.length, 3);
});

test("a broken usage store is not required, and an empty document is still refused first", async (t) => {
  process.env.ANTHROPIC_API_KEY = "test-key";
  const anthropic = mockAnthropic();
  t.after(() => anthropic.restore());
  const busy = {
    async get() {
      throw new Error("blobs down");
    },
    async compareAndSet() {
      return false;
    },
  };
  const down = await handler(eventFor(), contextFor(busy));
  assert.equal(down.statusCode, 402);
  assert.equal(JSON.parse(down.body).code, "needs_plan");
  assert.equal(anthropic.calls.length, 0);

  const empty = await handler(eventFor({ doc: "   " }), contextFor(createMemoryUsageStore()));
  assert.equal(empty.statusCode, 400);
});

test("without a usage store an unpaid explanation is still refused", async (t) => {
  process.env.ANTHROPIC_API_KEY = "test-key";
  const anthropic = mockAnthropic();
  t.after(() => anthropic.restore());
  const response = await handler(eventFor());
  assert.equal(response.statusCode, 402);
  assert.equal(JSON.parse(response.body).code, "needs_plan");
  assert.equal(anthropic.calls.length, 0);
});

test("the browser treats a paywall as final and keeps one explanation id for every part", async () => {
  await assert.rejects(
    () => postDecode({ language: "en" }, {
      fetchImpl: async () => ({
        ok: false,
        status: 402,
        text: async () => JSON.stringify({
          error: "This explanation is paid. There is no free explanation.",
          code: "needs_plan",
        }),
      }),
    }),
    (err) => {
      assert.equal(err instanceof DecodeError, true);
      assert.equal(err.retryable, false);
      assert.equal(err.code, "needs_plan");
      assert.match(err.message, /no free explanation/i);
      return true;
    },
  );

  const policy = buildSamplePolicy({ pages: 18 });
  const calls = [];
  await runDecode({
    text: policy,
    country: "Canada",
    region: "Alberta",
    language: "es",
    request: async (payload) => {
      calls.push(payload);
      if (payload.mode === "extract" || payload.mode === "reduce") return "{\"flags\":\"nota\"}";
      return sections();
    },
    sleep: async () => {},
  });
  assert.ok(calls.length > 2);
  assert.equal(new Set(calls.map((call) => call.explanationId)).size, 1);
  assert.equal(cleanExplanationId(calls[0].explanationId), calls[0].explanationId);
  assert.ok(calls.every((call) => call.language === "es"));
});

test("the blob adapter writes only when the previous version still matches", async () => {
  const saved = new Map();
  const store = adaptBlobStore({
    async getWithMetadata(key, options) {
      assert.equal(options.type, "json");
      const entry = saved.get(key);
      if (!entry) return null;
      return { data: JSON.parse(entry.json), etag: entry.etag };
    },
    async setJSON(key, value, options) {
      const entry = saved.get(key);
      if (options.onlyIfNew && entry) return { modified: false };
      if (options.onlyIfMatch && entry?.etag !== options.onlyIfMatch) return { modified: false };
      if (options.onlyIfMatch && !entry) return { modified: false };
      const etag = String((Number(entry?.etag) || 0) + 1);
      saved.set(key, { json: JSON.stringify(value), etag });
      return { modified: true, etag };
    },
  });

  assert.equal(await store.compareAndSet("hash", { month: "2026-11", used: 1 }, null), true);
  const first = await store.get("hash");
  assert.equal(first.value.used, 1);
  assert.equal(await store.compareAndSet("hash", { month: "2026-11", used: 2 }, "stale"), false);
  assert.equal(await store.compareAndSet("hash", { month: "2026-11", used: 2 }, first.etag), true);
  assert.equal((await store.get("hash")).value.used, 2);
});

const USER_A = "11111111-1111-4111-8111-111111111111";
const TOKEN_A = "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJhIn0.sigAaaaa";

test("a signed-in person without a plan is refused, and a yearly plan still explains", async (t) => {
  process.env.ANTHROPIC_API_KEY = "test-key";
  const anthropic = mockAnthropic();
  t.after(() => anthropic.restore());
  const store = createMemoryUsageStore();
  const accounts = createMemoryAccountStore();
  const verifySession = async ({ token }) => {
    if (token !== TOKEN_A) return null;
    return { id: USER_A, email: "should-not-be-stored@example.com", paid: true };
  };

  const unpaid = await handler(eventFor({
    headers: {
      "x-nf-client-connection-ip": IP,
      authorization: `Bearer ${TOKEN_A}`,
    },
    extra: { userId: USER_A, paid: true },
  }), contextFor(store, { verifySession, accountStore: accounts }));
  assert.equal(unpaid.statusCode, 402);
  assert.equal(anthropic.calls.length, 0);
  assert.deepEqual(store.snapshot(), {});

  const paidAccounts = createMemoryAccountStore({
    [USER_A]: { paid: true, plan: "yearly", yearly_used: 0, period_end: "2027-11-07T00:10:00.000Z" },
  });
  const paid = await handler(eventFor({
    headers: {
      "x-nf-client-connection-ip": IP,
      authorization: `Bearer ${TOKEN_A}`,
    },
  }), contextFor(store, {
    verifySession,
    accountStore: paidAccounts,
    now: new Date("2026-11-02T15:00:00Z"),
  }));
  assert.equal(paid.statusCode, 200, paid.body);
  assert.equal(JSON.parse(paid.body).usage.plan, "yearly");
  assert.equal(paidAccounts.snapshot()[USER_A].yearly_used, 1);
  const dumped = JSON.stringify(store.snapshot()) + JSON.stringify(paidAccounts.snapshot());
  assert.equal(dumped.includes(MARKER), false);
  assert.equal(dumped.includes("should-not-be-stored@example.com"), false);
});

test("a rejected or broken session does not explain", async (t) => {
  process.env.ANTHROPIC_API_KEY = "test-key";
  const anthropic = mockAnthropic();
  t.after(() => anthropic.restore());
  const store = createMemoryUsageStore();
  const pretending = await handler(eventFor({
    headers: {
      "x-nf-client-connection-ip": IP,
      authorization: "Bearer not-a-session",
    },
    extra: { userId: USER_A, paid: true, unlimited: true },
  }), contextFor(store, {
    verifySession: async () => {
      throw new Error("should not be called for a token that is not a session");
    },
  }));
  assert.equal(pretending.statusCode, 402);

  const broken = await handler(eventFor({
    headers: {
      "x-nf-client-connection-ip": IP,
      authorization: `Bearer ${TOKEN_A}`,
    },
  }), contextFor(store, {
    verifySession: async () => {
      throw new Error("supabase down");
    },
  }));
  assert.equal(broken.statusCode, 402);
  assert.equal(anthropic.calls.length, 0);
  assert.deepEqual(store.snapshot(), {});
});

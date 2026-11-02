import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";

import { DecodeError, postDecode, runDecode } from "../shared/decodeRun.js";
import { hasUnlimitedAccess } from "../shared/access.js";
import { buildSamplePolicy } from "../shared/samplePolicy.js";
import {
  FREE_EXPLANATION_LIMIT,
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

test("the free allowance is three explanations, and the reset date is the next UTC month", () => {
  assert.equal(FREE_EXPLANATION_LIMIT, 3);
  const midMonth = new Date("2026-11-15T23:30:00Z");
  assert.equal(monthKey(midMonth), "2026-11");
  assert.equal(resetsOnIso(midMonth), "2026-12-01");
  assert.equal(resetsOnIso(new Date("2026-12-31T23:59:00Z")), "2027-01-01");
  assert.match(formatResetDate("2026-12-01", "en"), /December/);
  assert.match(formatResetDate("2026-12-01", "en"), /2026/);
  assert.match(formatResetDate("2026-12-01", "fr"), /décembre/);
  assert.match(formatResetDate("2026-12-01", "es"), /diciembre/);

  const usage = { limited: true, remaining: 2, resetsOn: "2026-12-01" };
  assert.match(usageStatusMessage("en", usage), /2 free explanations left/);
  assert.match(usageStatusMessage("en", usage), /December/);
  assert.match(usageStatusMessage("fr", { ...usage, remaining: 1 }), /1 explication gratuite/);
  assert.match(usageStatusMessage("es", { ...usage, remaining: 0 }), /3 explicaciones gratuitas/);
  assert.match(usageStatusMessage("es", { ...usage, remaining: 0 }), /opciones de pago/);
  assert.match(usageStatusMessage("fr", { ...usage, remaining: 0 }), /options payantes/);
  assert.equal(usageStatusMessage("en", { limited: false }), "");
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

test("a signed-in or paid visitor is not unlimited until a later step says so", async () => {
  assert.equal(await hasUnlimitedAccess({ payload: { unlimited: true, paid: true } }), false);
});

test("three explanations are allowed, the fourth is refused, and the document is not stored", async (t) => {
  process.env.ANTHROPIC_API_KEY = "test-key";
  const anthropic = mockAnthropic();
  t.after(() => anthropic.restore());
  const store = createMemoryUsageStore();
  const now = new Date("2026-11-02T15:00:00Z");

  for (let n = 1; n <= 3; n++) {
    const response = await handler(eventFor({ id: randomUUID() }), contextFor(store, { now }));
    assert.equal(response.statusCode, 200, `explanation ${n}`);
    const body = JSON.parse(response.body);
    assert.equal(body.usage.limited, true);
    assert.equal(body.usage.used, n);
    assert.equal(body.usage.remaining, 3 - n);
    assert.equal(body.usage.resetsOn, "2026-12-01");
  }
  assert.equal(anthropic.calls.length, 3);

  const blocked = await handler(
    eventFor({ id: randomUUID(), language: "fr", extra: { unlimited: true, paid: true, skipLimit: true } }),
    contextFor(store, { now }),
  );
  assert.equal(blocked.statusCode, 402);
  const body = JSON.parse(blocked.body);
  assert.equal(body.code, "monthly_limit");
  assert.match(body.error, /3 explications gratuites/);
  assert.match(body.error, /options payantes/);
  assert.match(body.error, /décembre/);
  assert.equal(body.usage.remaining, 0);
  assert.equal(anthropic.calls.length, 3);

  const spanish = await handler(eventFor({ language: "es" }), contextFor(store, { now }));
  assert.equal(spanish.statusCode, 402);
  assert.match(JSON.parse(spanish.body).error, /explicaciones gratuitas/);
  assert.match(JSON.parse(spanish.body).error, /opciones de pago/);

  const dumped = JSON.stringify(store.snapshot());
  assert.equal(dumped.includes(MARKER), false);
  assert.equal(dumped.includes(IP), false);
  assert.equal(dumped.includes("Alberta"), false);
  assert.match(dumped, /"used":3/);
});

test("parts of one document share one explanation, and a new month starts again", async (t) => {
  process.env.ANTHROPIC_API_KEY = "test-key";
  const anthropic = mockAnthropic();
  t.after(() => anthropic.restore());
  const store = createMemoryUsageStore();
  const id = randomUUID();
  const november = new Date("2026-11-20T00:00:00Z");

  for (const mode of ["extract", "extract", "synthesize"]) {
    const response = await handler(
      eventFor({
        id,
        mode,
        doc: mode === "synthesize" ? "" : `Part text. ${MARKER}`,
        notes: mode === "synthesize" ? "Notes about a deductible." : undefined,
      }),
      contextFor(store, { now: november }),
    );
    assert.equal(response.statusCode, 200, mode);
    assert.equal(JSON.parse(response.body).usage.used, 1);
  }

  const fourthDocument = await handler(eventFor(), contextFor(store, { now: november }));
  assert.equal(fourthDocument.statusCode, 200);
  await handler(eventFor(), contextFor(store, { now: november }));
  const blocked = await handler(eventFor(), contextFor(store, { now: november }));
  assert.equal(blocked.statusCode, 402);

  const stillFinishing = await handler(
    eventFor({ id, mode: "synthesize", notes: "More notes." }),
    contextFor(store, { now: november }),
  );
  assert.equal(stillFinishing.statusCode, 200);
  assert.equal(JSON.parse(stillFinishing.body).usage.used, 3);

  const december = await handler(
    eventFor(),
    contextFor(store, { now: new Date("2026-12-01T00:00:00Z") }),
  );
  assert.equal(december.statusCode, 200);
  assert.equal(JSON.parse(december.body).usage.used, 1);
  assert.equal(JSON.parse(december.body).usage.resetsOn, "2027-01-01");
  assert.equal(JSON.stringify(store.snapshot()).includes(MARKER), false);
});

test("a failed reading does not use up an explanation, and a later failure keeps one already counted", async (t) => {
  process.env.ANTHROPIC_API_KEY = "test-key";
  const anthropic = mockAnthropic(500);
  t.after(() => anthropic.restore());
  const store = createMemoryUsageStore();
  const failed = await handler(eventFor(), contextFor(store));
  assert.equal(failed.statusCode, 502);
  const rolledBack = Object.values(store.snapshot())[0];
  assert.equal(rolledBack.used, 0);
  assert.deepEqual(rolledBack.explanations, {});

  anthropic.restore();
  const ok = mockAnthropic(200);
  t.after(() => ok.restore());
  const first = await handler(eventFor({ id: randomUUID() }), contextFor(store));
  assert.equal(first.statusCode, 200);
  const id = randomUUID();
  const started = await handler(eventFor({ id }), contextFor(store));
  assert.equal(JSON.parse(started.body).usage.used, 2);

  ok.restore();
  const again = mockAnthropic(500);
  t.after(() => again.restore());
  const continuation = await handler(eventFor({ id, mode: "synthesize", notes: "notes" }), contextFor(store));
  assert.equal(continuation.statusCode, 502);
  const saved = Object.values(store.snapshot())[0];
  assert.equal(saved.used, 2);
  assert.equal(saved.explanations[id] > 1, true);
});

test("a different connection has its own three, and a spoofed forwarded header does not", async (t) => {
  process.env.ANTHROPIC_API_KEY = "test-key";
  const anthropic = mockAnthropic();
  t.after(() => anthropic.restore());
  const store = createMemoryUsageStore();

  for (let n = 0; n < 3; n++) {
    assert.equal((await handler(eventFor({ ip: IP }), contextFor(store))).statusCode, 200);
  }
  assert.equal((await handler(eventFor({ ip: IP }), contextFor(store))).statusCode, 402);
  assert.equal((await handler(eventFor({ ip: "203.0.113.20" }), contextFor(store))).statusCode, 200);

  const spoofed = await handler(eventFor({
    headers: {
      "x-nf-client-connection-ip": IP,
      "x-forwarded-for": "198.51.100.50",
    },
  }), contextFor(store));
  assert.equal(spoofed.statusCode, 402);

  const forwardedOnly = await handler(eventFor({
    headers: { "x-forwarded-for": "198.51.100.77" },
  }), contextFor(store));
  const forwardedOther = await handler(eventFor({
    headers: { "x-forwarded-for": "198.51.100.88" },
  }), contextFor(store));
  assert.equal(forwardedOnly.statusCode, 200);
  assert.equal(forwardedOther.statusCode, 200);
  const thirdShared = await handler(eventFor({
    headers: { "x-forwarded-for": "203.0.113.99" },
  }), contextFor(store));
  assert.equal(thirdShared.statusCode, 200);
  const fourthShared = await handler(eventFor({
    headers: { "x-forwarded-for": "192.0.2.1" },
  }), contextFor(store));
  assert.equal(fourthShared.statusCode, 402);
});

test("an unlimited access hook skips the store, and a body flag does not", async (t) => {
  process.env.ANTHROPIC_API_KEY = "test-key";
  const anthropic = mockAnthropic();
  t.after(() => anthropic.restore());
  const store = createMemoryUsageStore();
  for (let n = 0; n < 5; n++) {
    const response = await handler(eventFor({ extra: { unlimited: true } }), contextFor(store, {
      hasUnlimitedAccess: async () => true,
    }));
    assert.equal(response.statusCode, 200);
    assert.equal(JSON.parse(response.body).usage.limited, false);
  }
  assert.deepEqual(store.snapshot(), {});
  assert.equal(anthropic.calls.length, 5);
});

test("parallel explanations cannot slip past the monthly cap", async (t) => {
  process.env.ANTHROPIC_API_KEY = "test-key";
  const anthropic = mockAnthropic();
  t.after(() => anthropic.restore());
  const store = createMemoryUsageStore();
  const responses = await Promise.all(
    Array.from({ length: 8 }, () => handler(eventFor(), contextFor(store))),
  );
  const allowed = responses.filter((response) => response.statusCode === 200);
  const blocked = responses.filter((response) => response.statusCode === 402);
  assert.equal(allowed.length, 3);
  assert.equal(blocked.length, 5);
  assert.equal(anthropic.calls.length, 3);
});

test("a store that cannot record the count does not call the model", async (t) => {
  process.env.ANTHROPIC_API_KEY = "test-key";
  const anthropic = mockAnthropic();
  t.after(() => anthropic.restore());

  const busy = {
    async get() {
      return { value: null, etag: null };
    },
    async compareAndSet() {
      return false;
    },
  };
  const busyResponse = await handler(eventFor(), contextFor(busy));
  assert.equal(busyResponse.statusCode, 503);
  assert.equal(JSON.parse(busyResponse.body).code, "usage_busy");
  assert.equal(anthropic.calls.length, 0);

  const down = {
    async get() {
      throw new Error("blobs down");
    },
    async compareAndSet() {
      return false;
    },
  };
  const downResponse = await handler(eventFor(), contextFor(down));
  assert.equal(downResponse.statusCode, 500);
  assert.equal(anthropic.calls.length, 0);
});

test("an empty document and a closed explanation do not spend a new credit", async (t) => {
  process.env.ANTHROPIC_API_KEY = "test-key";
  const anthropic = mockAnthropic();
  t.after(() => anthropic.restore());
  const store = createMemoryUsageStore();
  const empty = await handler(eventFor({ doc: "   " }), contextFor(store));
  assert.equal(empty.statusCode, 400);
  assert.deepEqual(store.snapshot(), {});

  const id = randomUUID();
  const key = usageStorageKey(IP, usageSalt());
  await store.compareAndSet(key, {
    month: monthKey(new Date()),
    used: 1,
    explanations: { [id]: 120 },
  }, null);
  const closed = await handler(eventFor({ id }), contextFor(store));
  assert.equal(closed.statusCode, 400);
  assert.equal(JSON.parse(closed.body).code, "explanation_closed");
  assert.equal(anthropic.calls.length, 0);
  assert.equal(Object.values(store.snapshot())[0].used, 1);
});

test("without a usage store the function still explains, so local tests stay open", async (t) => {
  process.env.ANTHROPIC_API_KEY = "test-key";
  const anthropic = mockAnthropic();
  t.after(() => anthropic.restore());
  for (let n = 0; n < 4; n++) {
    const response = await handler(eventFor());
    assert.equal(response.statusCode, 200);
    assert.equal(JSON.parse(response.body).usage, undefined);
  }
});

test("the browser treats the monthly limit as final and keeps one explanation id for every part", async () => {
  const usage = { limited: true, limit: 3, used: 3, remaining: 0, resetsOn: "2026-12-01" };
  await assert.rejects(
    () => postDecode({ language: "en" }, {
      fetchImpl: async () => ({
        ok: false,
        status: 402,
        text: async () => JSON.stringify({
          error: "You've used your 3 free explanations this month. They reset on December 1, 2026. Paid options are coming soon.",
          code: "monthly_limit",
          usage,
        }),
      }),
    }),
    (err) => {
      assert.equal(err instanceof DecodeError, true);
      assert.equal(err.retryable, false);
      assert.equal(err.code, "monthly_limit");
      assert.equal(err.usage.remaining, 0);
      assert.match(err.message, /Paid options are coming soon/);
      return true;
    },
  );

  const seen = [];
  await postDecode({ language: "fr" }, {
    fetchImpl: async () => ({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ text: "note", usage: { limited: true, remaining: 2, resetsOn: "2026-12-01" } }),
    }),
    onUsage: (next) => seen.push(next),
  });
  assert.equal(seen[0].remaining, 2);

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

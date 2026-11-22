import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";

import { createMemoryAccountStore } from "../shared/accountStore.js";
import { handler } from "../netlify/functions/decode.js";
import { currencyForCountry, selectPrice } from "../shared/plans.js";
import { locationBlock, systemFor } from "../shared/prompts.js";
import {
  GENERAL_COUNTRY,
  commitRegion,
  generalCountryOptions,
  isGeneralCountry,
} from "../shared/regions.js";
import {
  GENERAL_FREE_LIMIT,
  GENERAL_SIGNUPS_PER_IP_PER_DAY,
  usageAppliesHere,
  usageStatusMessage,
} from "../shared/usageCopy.js";
import {
  createMemoryUsageStore,
  generalAccountMark,
  generalAccountSubject,
  usageSalt,
  usageStorageKey,
} from "../shared/usageGate.js";

const MARKER = "POLICY_SECRET_MARKER_do_not_store";
const IP = "203.0.113.40";
const USER_A = "11111111-1111-4111-8111-111111111111";
const USER_B = "22222222-2222-4222-8222-222222222222";
const TOKEN_A = "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJhIn0.sigAaaaa";
const TOKEN_B = "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJiIn0.sigBbbbb";

function sections() {
  return JSON.stringify({
    summary: "A short summary. This is a general explanation, not local advice.",
    flags: "• A deductible applies. The name varies by country.",
    questions: "• Ask a local insurer or broker what this exclusion means.",
    terms: "Deductible: the amount you pay first. It varies by country.",
  });
}

function mockAnthropic() {
  const calls = [];
  const original = globalThis.fetch;
  globalThis.fetch = async (url, options) => {
    calls.push({ url: String(url), body: JSON.parse(options.body) });
    return {
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ content: [{ text: sections() }] }),
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
  country = GENERAL_COUNTRY,
  region = "Kenya",
  doc = `A deductible of 500 applies before a claim. Flood is excluded. ${MARKER}`,
  mode = "single",
  notes,
  headers,
  token,
} = {}) {
  return {
    httpMethod: "POST",
    headers: headers || {
      "x-nf-client-connection-ip": ip,
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({
      mode,
      docText: mode === "synthesize" ? undefined : doc,
      notes,
      language,
      country,
      region,
      explanationId: id,
    }),
  };
}

function signedContext(store, extra = {}) {
  return {
    usageStore: store,
    verifySession: async ({ token }) => {
      if (token === TOKEN_A) return { id: USER_A, email: "ada@example.com" };
      if (token === TOKEN_B) return { id: USER_B, email: "bea@example.com" };
      const match = /^eyJhbGciOiJIUzI1NiJ9\.eyJzdWIiOiJ1c2VyIn0\.sig(\d+)$/.exec(String(token || ""));
      if (!match) return null;
      const n = Number(match[1]);
      return { id: `00000000-0000-4000-8000-${String(n).padStart(12, "0")}` };
    },
    ...extra,
  };
}

function crowdToken(n) {
  return `eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1c2VyIn0.sig${String(n).padStart(4, "0")}`;
}

test("General is a country list, not a set of local rules", () => {
  assert.equal(isGeneralCountry(GENERAL_COUNTRY), true);
  assert.equal(isGeneralCountry("Kenya"), true);
  assert.equal(isGeneralCountry("Canada"), false);
  assert.equal(isGeneralCountry("United States"), false);
  assert.equal(isGeneralCountry(""), false);

  for (const lang of ["en", "fr", "es"]) {
    const options = generalCountryOptions(lang);
    assert.ok(options.length > 150, lang);
    assert.equal(options.some((option) => option.value === "Canada" || option.value === "United States"), false);
    assert.equal(options.some((option) => option.value === "Kenya"), true);
    assert.equal(options.some((option) => option.value === "Germany"), true);
    const germany = options.find((option) => option.value === "Germany");
    if (lang === "en") assert.equal(germany.label, "Germany");
    if (lang === "fr") assert.equal(germany.label, "Allemagne");
    if (lang === "es") assert.equal(germany.label, "Alemania");
    assert.equal(commitRegion(options, "kenya"), "Kenya");
  }

  const french = generalCountryOptions("fr");
  assert.equal(commitRegion(french, "allemagne"), "Germany");
  assert.equal(commitRegion(french, ""), "");
});

test("General prompts stay neutral, and Canada and the US prompts stay as they were", () => {
  const local = systemFor("single", "en");
  assert.match(local, /plain, simple English/);
  assert.match(local, /Canadian provinces/);
  assert.equal(local.includes("This is a general explanation"), false);

  for (const lang of ["en", "fr", "es"]) {
    for (const mode of ["single", "extract", "reduce", "compare"]) {
      const system = systemFor(mode, lang, "general");
      assert.match(system, /not local legal, financial, or insurance advice/);
      assert.match(system, /general explanation|explanation is general/);
      assert.match(system, /Do not (assume|add) Canadian or United States law/);
      assert.match(system, /varies by country/);
      assert.match(system, /local insurer or broker/);
      assert.equal(system.includes("tailor your explanation to that specific jurisdiction"), false);
      assert.equal(system.includes("common risks for this province or state"), false);
    }
  }
  assert.match(systemFor("single", "fr", "general"), /Canadian French/);
  assert.match(systemFor("single", "es", "general"), /Latin American Spanish/);
  assert.match(systemFor("compare", "en"), /common risks for this province or state/);

  assert.equal(locationBlock("Canada", "Alberta", "en"), "Country: Canada\nProvince: Alberta");
  assert.match(locationBlock("United States", "Ohio", "fr"), /State: Ohio/);
  assert.match(locationBlock("United States", "Ohio", "fr"), /Canadian French/);
  const general = locationBlock(GENERAL_COUNTRY, "Kenya", "en");
  assert.match(general, /Mode: General/);
  assert.match(general, /Country named by the person: Kenya/);
  assert.match(general, /Do not apply this country's insurance law/);
  assert.equal(general.includes("Province"), false);
  assert.equal(general.includes("State:"), false);
});

test("General prices are the existing US dollar prices", () => {
  assert.equal(GENERAL_FREE_LIMIT, 1);
  assert.equal(currencyForCountry("Canada"), "cad");
  assert.equal(currencyForCountry("United States"), "usd");
  assert.equal(currencyForCountry(GENERAL_COUNTRY), "usd");
  const prices = [
    { id: "price_house_usd", active: true, currency: "usd", product: "prod_VYa35DVVX8zzUK", recurring: null },
    { id: "price_year_usd", active: true, currency: "usd", product: "prod_VYaEVm0qbwlG00", recurring: { interval: "year" } },
  ];
  assert.equal(selectPrice(prices, { plan: "household", currency: "usd", product: "prod_VYa35DVVX8zzUK" }).id, "price_house_usd");
  assert.equal(selectPrice(prices, { plan: "yearly", currency: "usd", product: "prod_VYaEVm0qbwlG00" }).id, "price_year_usd");
  assert.match(usageStatusMessage("en", { limited: true, once: true, remaining: 1 }), /1 free explanation/);
  assert.match(usageStatusMessage("en", { limited: true, once: true, remaining: 1 }), /does not reset each month/);
  assert.match(usageStatusMessage("en", { limited: true, once: true, remaining: 0 }), /used your free explanation/);
  assert.match(usageStatusMessage("en", { limited: true, once: true, remaining: 0 }), /US dollars/);
  assert.equal(usageStatusMessage("en", { limited: true, once: true, remaining: 0 }).includes("reset on"), false);
  assert.match(usageStatusMessage("fr", { limited: true, once: true, remaining: 0 }), /explication gratuite/);
  assert.match(usageStatusMessage("es", { limited: true, once: true, remaining: 0 }), /explicación gratuita/);
  const once = { limited: true, once: true, remaining: 0 };
  const monthly = { limited: true, remaining: 0, resetsOn: "2026-12-01" };
  const yearly = { limited: true, plan: "yearly", remaining: 4, resetsOn: "2027-01-01" };
  assert.equal(usageAppliesHere(once, true), true);
  assert.equal(usageAppliesHere(once, false), false);
  assert.equal(usageAppliesHere(monthly, false), true);
  assert.equal(usageAppliesHere(monthly, true), false);
  assert.equal(usageAppliesHere(yearly, true), true);
  assert.equal(usageAppliesHere(yearly, false), true);
});

test("one General explanation is free, a new month does not reset it, and Canada still has three", async (t) => {
  process.env.ANTHROPIC_API_KEY = "test-key";
  const anthropic = mockAnthropic();
  t.after(() => anthropic.restore());
  const store = createMemoryUsageStore();
  const november = new Date("2026-11-15T12:00:00Z");
  const context = signedContext(store, { now: november });

  const signedOut = await handler(eventFor(), context);
  assert.equal(signedOut.statusCode, 401);
  assert.equal(JSON.parse(signedOut.body).code, "general_sign_in");
  assert.match(JSON.parse(signedOut.body).error, /Sign in with your email/);
  assert.deepEqual(store.snapshot(), {});

  const first = await handler(eventFor({ token: TOKEN_A }), context);
  assert.equal(first.statusCode, 200, first.body);
  const body = JSON.parse(first.body);
  assert.equal(body.usage.once, true);
  assert.equal(body.usage.limit, 1);
  assert.equal(body.usage.used, 1);
  assert.equal(body.usage.remaining, 0);
  assert.equal(body.usage.resetsOn, undefined);
  const prompt = anthropic.calls[0].body;
  assert.match(prompt.system, /general explanation, not local legal/);
  assert.match(prompt.messages[0].content, /Country named by the person: Kenya/);
  assert.equal(String(prompt.messages[0].content).includes("Province:"), false);

  const second = await handler(eventFor({ token: TOKEN_A, language: "fr" }), context);
  assert.equal(second.statusCode, 402);
  const blocked = JSON.parse(second.body);
  assert.equal(blocked.code, "general_limit");
  assert.match(blocked.error, /explication gratuite/);
  assert.match(blocked.error, /ne recommence pas chaque mois/);
  assert.equal(blocked.error.includes("3 explications"), false);
  assert.equal(anthropic.calls.length, 1);

  const december = await handler(
    eventFor({ token: TOKEN_A }),
    signedContext(store, { now: new Date("2026-12-20T12:00:00Z") }),
  );
  assert.equal(december.statusCode, 402);
  assert.equal(JSON.parse(december.body).code, "general_limit");

  for (let n = 1; n <= 3; n++) {
    const canada = await handler(eventFor({
      country: "Canada",
      region: "Alberta",
      id: randomUUID(),
    }), context);
    assert.equal(canada.statusCode, 200, `canada ${n} ${canada.body}`);
    assert.equal(JSON.parse(canada.body).usage.once, undefined);
    assert.equal(JSON.parse(canada.body).usage.remaining, 3 - n);
    assert.equal(JSON.parse(canada.body).usage.resetsOn, "2026-12-01");
  }
  const canadaBlocked = await handler(eventFor({ country: "Canada", region: "Alberta" }), context);
  assert.equal(canadaBlocked.statusCode, 402);
  assert.equal(JSON.parse(canadaBlocked.body).code, "monthly_limit");

  const dumped = JSON.stringify(store.snapshot());
  assert.equal(dumped.includes(MARKER), false);
  assert.equal(dumped.includes(IP), false);
  assert.equal(dumped.includes("Kenya"), false);
  assert.match(dumped, /"scope":"once"/);
  assert.equal(dumped.includes("\"month\":\"2026-11\""), true);
});

test("a failed General reading does not use the try, and parts of one document share it", async (t) => {
  process.env.ANTHROPIC_API_KEY = "test-key";
  const original = globalThis.fetch;
  let status = 500;
  globalThis.fetch = async () => ({
    ok: status >= 200 && status < 300,
    status,
    text: async () => JSON.stringify(
      status === 200 ? { content: [{ text: sections() }] } : { error: { type: "server" } },
    ),
  });
  t.after(() => {
    globalThis.fetch = original;
  });
  const store = createMemoryUsageStore();
  const context = signedContext(store);
  const failed = await handler(eventFor({ token: TOKEN_A }), context);
  assert.equal(failed.statusCode, 502);
  const accountKey = usageStorageKey(generalAccountSubject({ id: USER_A }), usageSalt());
  assert.equal(store.snapshot()[accountKey].used, 0);
  const rateRecords = Object.values(store.snapshot()).filter((record) => record.scope === "once-rate");
  assert.ok(rateRecords.every((record) => record.accounts.length === 0));

  status = 200;
  const id = randomUUID();
  const november = new Date("2026-11-02T00:00:00Z");
  for (const mode of ["extract", "synthesize"]) {
    const response = await handler(eventFor({
      token: TOKEN_A,
      id,
      mode,
      notes: mode === "synthesize" ? "Notes about a deductible." : undefined,
    }), signedContext(store, { now: november }));
    assert.equal(response.statusCode, 200, response.body);
    assert.equal(JSON.parse(response.body).usage.used, 1);
  }
  const again = await handler(eventFor({ token: TOKEN_A }), signedContext(store, { now: new Date("2027-01-01T00:00:00Z") }));
  assert.equal(again.statusCode, 402);
  const still = await handler(eventFor({
    token: TOKEN_A,
    id,
    mode: "synthesize",
    notes: "More notes.",
  }), signedContext(store));
  assert.equal(still.statusCode, 200, still.body);
});

test("the General try belongs to the account, and another person on the same connection keeps theirs", async (t) => {
  process.env.ANTHROPIC_API_KEY = "test-key";
  const anthropic = mockAnthropic();
  t.after(() => anthropic.restore());
  const store = createMemoryUsageStore();
  const context = signedContext(store);
  assert.equal(generalAccountSubject(null), "");
  assert.equal(generalAccountSubject({ id: USER_A }), `once:user:${USER_A}`);
  assert.equal(generalAccountMark(USER_A, usageSalt()).includes(USER_A), false);

  const first = await handler(eventFor({ token: TOKEN_A }), context);
  assert.equal(first.statusCode, 200, first.body);
  const otherNetwork = await handler(eventFor({ token: TOKEN_A, ip: "203.0.113.41" }), context);
  assert.equal(otherNetwork.statusCode, 402);
  assert.equal(JSON.parse(otherNetwork.body).code, "general_limit");

  const otherAccount = await handler(eventFor({ token: TOKEN_B, ip: IP }), context);
  assert.equal(otherAccount.statusCode, 200, otherAccount.body);
  assert.equal(JSON.parse(otherAccount.body).usage.used, 1);

  const signedOut = await handler(eventFor({ ip: IP }), context);
  assert.equal(signedOut.statusCode, 401);
  assert.equal(JSON.parse(signedOut.body).code, "general_sign_in");

  const dumped = JSON.stringify(store.snapshot());
  assert.equal(dumped.includes(MARKER), false);
  assert.equal(dumped.includes(USER_A), false);
  assert.equal(dumped.includes(USER_B), false);
  assert.equal(dumped.includes("ada@example.com"), false);
  assert.equal(dumped.includes(IP), false);
  const accountKey = usageStorageKey(generalAccountSubject({ id: USER_A }), usageSalt());
  assert.equal(store.snapshot()[accountKey].used, 1);
  assert.equal(store.snapshot()[accountKey].scope, "once");
  assert.equal(store.snapshot()[usageStorageKey(`once:${IP}`, usageSalt())], undefined);
});

test("one connection can start many General free tries in a day, and the next account is not charged", async (t) => {
  process.env.ANTHROPIC_API_KEY = "test-key";
  const anthropic = mockAnthropic();
  t.after(() => anthropic.restore());
  const store = createMemoryUsageStore();
  const today = new Date("2026-11-22T08:00:00Z");
  assert.equal(GENERAL_SIGNUPS_PER_IP_PER_DAY >= 20, true);

  for (let n = 1; n <= GENERAL_SIGNUPS_PER_IP_PER_DAY; n++) {
    const response = await handler(eventFor({ token: crowdToken(n), ip: IP }), signedContext(store, { now: today }));
    assert.equal(response.statusCode, 200, `account ${n} ${response.body}`);
  }
  const blocked = await handler(
    eventFor({ token: crowdToken(GENERAL_SIGNUPS_PER_IP_PER_DAY + 1), ip: IP }),
    signedContext(store, { now: today }),
  );
  assert.equal(blocked.statusCode, 429);
  assert.equal(JSON.parse(blocked.body).code, "general_rate");
  assert.match(JSON.parse(blocked.body).error, /has not been used/);
  const heldBack = usageStorageKey(
    generalAccountSubject({ id: `00000000-0000-4000-8000-${String(GENERAL_SIGNUPS_PER_IP_PER_DAY + 1).padStart(12, "0")}` }),
    usageSalt(),
  );
  assert.equal(store.snapshot()[heldBack], undefined);

  const tomorrow = await handler(
    eventFor({ token: crowdToken(GENERAL_SIGNUPS_PER_IP_PER_DAY + 1), ip: IP }),
    signedContext(store, { now: new Date("2026-11-23T08:00:00Z") }),
  );
  assert.equal(tomorrow.statusCode, 200, tomorrow.body);
  assert.equal(store.snapshot()[heldBack].used, 1);
  assert.equal(anthropic.calls.length, GENERAL_SIGNUPS_PER_IP_PER_DAY + 1);
});

test("a named country other than Canada or the US is General, and a paid plan is not capped at one", async (t) => {
  process.env.ANTHROPIC_API_KEY = "test-key";
  const anthropic = mockAnthropic();
  t.after(() => anthropic.restore());
  const store = createMemoryUsageStore();
  const named = await handler(eventFor({ token: TOKEN_A, country: "France", region: "Not specified" }), signedContext(store));
  assert.equal(named.statusCode, 200, named.body);
  assert.match(anthropic.calls[0].body.system, /general explanation/);
  assert.match(anthropic.calls[0].body.messages[0].content, /Country named by the person: France/);
  const second = await handler(eventFor({ token: TOKEN_A, country: "France", region: "Not specified" }), signedContext(store));
  assert.equal(second.statusCode, 402);

  const user = USER_A;
  const accounts = createMemoryAccountStore({
    [user]: {
      paid: true,
      plan: "yearly",
      yearly_used: 0,
      period_end: "2027-11-07T00:10:00.000Z",
    },
  });
  const paidStore = createMemoryUsageStore();
  for (let n = 0; n < 2; n++) {
    const response = await handler(eventFor({ token: TOKEN_A, ip: "198.51.100.10" }), {
      usageStore: paidStore,
      accountStore: accounts,
      verifySession: async () => ({ id: user, email: "ada@example.com" }),
      now: new Date("2026-11-02T15:00:00Z"),
    });
    assert.equal(response.statusCode, 200, response.body);
    assert.equal(JSON.parse(response.body).usage.plan, "yearly");
  }
  assert.deepEqual(paidStore.snapshot(), {});
  assert.equal(accounts.snapshot()[user].yearly_used, 2);
});

test("parallel General explanations cannot slip past the one free try", async (t) => {
  process.env.ANTHROPIC_API_KEY = "test-key";
  const anthropic = mockAnthropic();
  t.after(() => anthropic.restore());
  const store = createMemoryUsageStore();
  const responses = await Promise.all(
    Array.from({ length: 6 }, () => handler(eventFor({ token: TOKEN_A }), signedContext(store))),
  );
  const allowed = responses.filter((response) => response.statusCode === 200);
  const blocked = responses.filter((response) => response.statusCode === 402);
  assert.equal(allowed.length, 1);
  assert.equal(blocked.length, 5);
  assert.equal(anthropic.calls.length, 1);
});

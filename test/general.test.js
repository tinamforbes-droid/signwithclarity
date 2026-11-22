import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";

import { createMemoryAccountStore } from "../shared/accountStore.js";
import { handler } from "../netlify/functions/decode.js";
import { currencyForCountry, selectPrice } from "../shared/plans.js";
import { locationBlock, systemFor } from "../shared/prompts.js";
import {
  GENERAL_COUNTRY,
  MANAGED_PAYMENTS_BLOCKED_COUNTRY_CODES,
  commitRegion,
  generalCountryOptions,
  isGeneralCountry,
} from "../shared/regions.js";
import { usageStatusMessage } from "../shared/usageCopy.js";
import { createMemoryUsageStore } from "../shared/usageGate.js";

const MARKER = "POLICY_SECRET_MARKER_do_not_store";
const IP = "203.0.113.40";
const USER_A = "11111111-1111-4111-8111-111111111111";
const TOKEN_A = "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJhIn0.sigAaaaa";

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
    assert.equal(options.some((option) => option.value === "Ukraine"), true);
    assert.equal(options.some((option) => option.value === "St. Helena"), true);
    assert.equal(options.some((option) => option.value === "Hong Kong SAR China"), true);
    assert.equal(options.some((option) => option.value === "South Korea"), true);
    for (const blocked of [
      "China", "Cuba", "Iran", "North Korea", "Russia", "Syria",
      "Ascension Island", "Kosovo", "Tristan da Cunha",
      "Crimea", "Donetsk", "Luhansk",
    ]) {
      assert.equal(options.some((option) => option.value === blocked || option.label === blocked), false, `${lang} ${blocked}`);
    }
    const germany = options.find((option) => option.value === "Germany");
    if (lang === "en") assert.equal(germany.label, "Germany");
    if (lang === "fr") assert.equal(germany.label, "Allemagne");
    if (lang === "es") assert.equal(germany.label, "Alemania");
    assert.equal(commitRegion(options, "kenya"), "Kenya");
  }

  assert.deepEqual(
    [...MANAGED_PAYMENTS_BLOCKED_COUNTRY_CODES].sort(),
    ["AC", "CN", "CU", "IR", "KP", "RU", "SY", "TA", "XK"],
  );

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
  assert.equal(currencyForCountry("Canada"), "cad");
  assert.equal(currencyForCountry("United States"), "usd");
  assert.equal(currencyForCountry(GENERAL_COUNTRY), "usd");
  const prices = [
    { id: "price_house_usd", active: true, currency: "usd", product: "prod_VYa35DVVX8zzUK", recurring: null },
    { id: "price_year_usd", active: true, currency: "usd", product: "prod_VYaEVm0qbwlG00", recurring: { interval: "year" } },
  ];
  assert.equal(selectPrice(prices, { plan: "household", currency: "usd", product: "prod_VYa35DVVX8zzUK" }).id, "price_house_usd");
  assert.equal(selectPrice(prices, { plan: "yearly", currency: "usd", product: "prod_VYaEVm0qbwlG00" }).id, "price_year_usd");
  assert.match(usageStatusMessage("en", { limited: true, plan: "yearly", remaining: 4, resetsOn: "2027-01-01" }), /explanations left/);
});

test("an explanation is paid in Canada, the United States, and General mode", async (t) => {
  process.env.ANTHROPIC_API_KEY = "test-key";
  const anthropic = mockAnthropic();
  t.after(() => anthropic.restore());
  const store = createMemoryUsageStore();

  for (const country of ["Canada", "United States", GENERAL_COUNTRY]) {
    const response = await handler(eventFor({ country, region: country === "Canada" ? "Alberta" : "Kenya" }), { usageStore: store });
    assert.equal(response.statusCode, 402, country + " " + response.body);
    const body = JSON.parse(response.body);
    assert.equal(body.code, "needs_plan");
    assert.match(body.error, /no free explanation/i);
    assert.equal(anthropic.calls.length, 0);
  }
  assert.deepEqual(store.snapshot(), {});

  const accounts = createMemoryAccountStore({
    [USER_A]: { paid: true, plan: "yearly", yearly_used: 0, period_end: "2027-11-07T00:10:00.000Z" },
  });
  const paid = await handler(eventFor({ token: TOKEN_A, country: GENERAL_COUNTRY, region: "Kenya" }), {
    usageStore: store,
    accountStore: accounts,
    verifySession: async () => ({ id: USER_A, email: "ada@example.com" }),
    now: new Date("2026-11-02T15:00:00Z"),
  });
  assert.equal(paid.statusCode, 200, paid.body);
  assert.equal(JSON.parse(paid.body).usage.plan, "yearly");
  assert.match(anthropic.calls[0].body.system, /general explanation/);
  assert.match(anthropic.calls[0].body.messages[0].content, /Country named by the person: Kenya/);
  assert.equal(accounts.snapshot()[USER_A].yearly_used, 1);

  const canada = await handler(eventFor({ token: TOKEN_A, country: "Canada", region: "Alberta" }), {
    usageStore: store,
    accountStore: accounts,
    verifySession: async () => ({ id: USER_A, email: "ada@example.com" }),
    now: new Date("2026-11-02T15:00:00Z"),
  });
  assert.equal(canada.statusCode, 200, canada.body);
  assert.equal(accounts.snapshot()[USER_A].yearly_used, 2);
  assert.deepEqual(store.snapshot(), {});
});

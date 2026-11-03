import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";

import { createMemoryAccountStore } from "../shared/accountStore.js";
import { runComparison } from "../shared/compareRun.js";
import { normalizeComparison } from "../shared/comparePolicy.js";
import { DecodeError } from "../shared/decodeRun.js";
import {
  canCompareAccount,
  decideConsume,
  visibleChecks,
} from "../shared/entitlement.js";
import { handler as decode } from "../netlify/functions/decode.js";
import { YEARLY_FAIR_USE_LIMIT } from "../shared/plans.js";
import { createMemoryUsageStore } from "../shared/usageGate.js";
import { planHintText } from "../src/planHints.js";

const USER = "11111111-1111-4111-8111-111111111111";
const TOKEN = "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1c2VyIn0.signature";
const MARKER = "POLICY_SECRET_MARKER_do_not_store";
const NOW = new Date("2026-11-02T15:00:00Z");

function accountContext(store, extra = {}) {
  return {
    accountStore: store,
    usageStore: extra.usageStore || createMemoryUsageStore(),
    now: NOW,
    env: extra.env || {},
    verifySession: extra.verifySession || (async () => ({ id: USER, email: "ada@example.com" })),
    fetchImpl: extra.fetchImpl,
    ...extra,
  };
}

function modelReply(text) {
  return {
    ok: true,
    status: 200,
    text: async () => JSON.stringify({ content: [{ text }] }),
  };
}

test("an older balance keeps its explanations and unlocks one check per four, rounded up", () => {
  assert.equal(visibleChecks({ credits_remaining: 4, checks_remaining: null }), 1);
  assert.equal(visibleChecks({ credits_remaining: 1, checks_remaining: null }), 1);
  assert.equal(visibleChecks({ credits_remaining: 5, checks_remaining: null }), 2);
  assert.equal(visibleChecks({ credits_remaining: 0, checks_remaining: null }), 0);
  assert.equal(visibleChecks({ credits_remaining: 4, checks_remaining: 0 }), 0);
  assert.equal(canCompareAccount({ paid: true, plan: "household", credits_remaining: 3, checks_remaining: null }, NOW), true);
  assert.equal(canCompareAccount({ paid: true, plan: "household", credits_remaining: 3, checks_remaining: 0 }, NOW), false);
  assert.equal(canCompareAccount(null, NOW), false);

  const migrated = decideConsume(
    { paid: true, plan: "household", credits_remaining: 5, checks_remaining: null, explanation_claims: {} },
    randomUUID(),
    NOW,
    { purpose: "compare" },
  );
  assert.equal(migrated.kind, "fresh");
  assert.equal(migrated.account.checks_remaining, 1);
  assert.equal(migrated.account.credits_remaining, 5);

  const blocked = decideConsume(
    { paid: true, plan: "household", credits_remaining: 3, checks_remaining: 0, explanation_claims: {} },
    randomUUID(),
    NOW,
    { purpose: "compare" },
  );
  assert.equal(blocked.kind, "needs_plan");
  assert.equal(blocked.account.credits_remaining, 3);
});

test("one comparison spends one check, not one credit per policy, and a failure gives it back", async (t) => {
  process.env.ANTHROPIC_API_KEY = "test-key";
  const original = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => {
    calls += 1;
    return modelReply("comparison text");
  };
  t.after(() => {
    globalThis.fetch = original;
  });

  const accounts = createMemoryAccountStore({
    [USER]: { paid: true, plan: "household", credits_remaining: 4 },
  });
  const usage = createMemoryUsageStore();
  const context = accountContext(accounts, { usageStore: usage });
  const id = randomUUID();
  const headers = { authorization: `Bearer ${TOKEN}`, "x-nf-client-connection-ip": "203.0.113.10" };

  for (const body of [
    { mode: "extract", purpose: "compare", docText: `Auto policy. ${MARKER}`, chunkIndex: 1, chunkCount: 2 },
    { mode: "extract", purpose: "compare", docText: "Home policy exclusion at the end.", chunkIndex: 2, chunkCount: 2 },
    {
      mode: "compare",
      purpose: "compare",
      policies: [
        { label: "Car", notes: `Notes about liability. ${MARKER}` },
        { label: "Home", notes: "Notes about fire." },
      ],
    },
  ]) {
    const response = await decode({
      httpMethod: "POST",
      headers,
      body: JSON.stringify({
        ...body,
        language: "en",
        country: "Canada",
        region: "Ontario",
        explanationId: id,
        comparisonId: id,
        paid: true,
      }),
    }, context);
    assert.equal(response.statusCode, 200, body.mode);
  }

  assert.equal(calls, 3);
  assert.equal(accounts.snapshot()[USER].credits_remaining, 4);
  assert.equal(accounts.snapshot()[USER].checks_remaining, 0);
  assert.equal(accounts.snapshot()[USER].paid, true);
  assert.equal(JSON.stringify(accounts.snapshot()).includes(MARKER), false);
  assert.equal(JSON.stringify(usage.snapshot()).includes(MARKER), false);
  assert.equal(Object.keys(usage.snapshot()).length, 0);

  calls = 0;
  const second = await decode({
    httpMethod: "POST",
    headers,
    body: JSON.stringify({
      mode: "compare",
      purpose: "compare",
      policies: [
        { label: "Car", notes: "Notes." },
        { label: "Pet", notes: "More notes." },
      ],
      language: "fr",
      country: "Canada",
      region: "Quebec",
      explanationId: randomUUID(),
      paid: true,
    }),
  }, context);
  assert.equal(second.statusCode, 402);
  assert.equal(JSON.parse(second.body).code, "compare_needs_plan");
  assert.match(JSON.parse(second.body).error, /Household Check/);
  assert.equal(calls, 0);
  assert.equal(accounts.snapshot()[USER].credits_remaining, 4);

  const freed = await decode({
    httpMethod: "POST",
    headers,
    body: JSON.stringify({
      mode: "single",
      docText: "A short clause.",
      language: "en",
      country: "Canada",
      region: "Ontario",
      explanationId: randomUUID(),
    }),
  }, context);
  assert.equal(freed.statusCode, 200);
  assert.equal(JSON.parse(freed.body).usage.kind, "explanation");
  assert.equal(accounts.snapshot()[USER].credits_remaining, 3);
  assert.equal(accounts.snapshot()[USER].checks_remaining, 0);
});

test("a comparison is not free, and a signed-out request does not reach the model", async (t) => {
  process.env.ANTHROPIC_API_KEY = "test-key";
  const original = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => {
    calls += 1;
    return modelReply("should not be asked");
  };
  t.after(() => {
    globalThis.fetch = original;
  });

  const usage = createMemoryUsageStore();
  const event = {
    httpMethod: "POST",
    headers: { "x-nf-client-connection-ip": "203.0.113.50" },
    body: JSON.stringify({
      mode: "compare",
      purpose: "compare",
      policies: [
        { label: "Car", notes: `Do not send. ${MARKER}` },
        { label: "Home", notes: "Notes." },
      ],
      language: "es",
      country: "United States",
      region: "Texas",
      explanationId: randomUUID(),
      paid: true,
    }),
  };
  const denied = await decode(event, accountContext(createMemoryAccountStore(), {
    usageStore: usage,
    verifySession: async () => null,
  }));
  assert.equal(denied.statusCode, 402);
  assert.equal(JSON.parse(denied.body).code, "compare_needs_plan");
  assert.match(JSON.parse(denied.body).error, /Household Check/);
  assert.equal(calls, 0);
  assert.equal(Object.keys(usage.snapshot()).length, 0);

  const tooFew = await decode({
    ...event,
    headers: { authorization: `Bearer ${TOKEN}`, "x-nf-client-connection-ip": "203.0.113.50" },
    body: JSON.stringify({
      mode: "compare",
      policies: [{ label: "Car", notes: "Only one." }],
      language: "en",
      country: "Canada",
      region: "Ontario",
      explanationId: randomUUID(),
    }),
  }, accountContext(createMemoryAccountStore({
    [USER]: { paid: true, plan: "household", credits_remaining: 0, checks_remaining: 1 },
  })));
  assert.equal(tooFew.statusCode, 400);
  assert.equal(calls, 0);
});

test("Clarity Yearly counts a comparison as one explanation, then a Household Check if the year is used up", async (t) => {
  process.env.ANTHROPIC_API_KEY = "test-key";
  const original = globalThis.fetch;
  globalThis.fetch = async () => modelReply("comparison text");
  t.after(() => {
    globalThis.fetch = original;
  });

  const yearly = createMemoryAccountStore({
    [USER]: {
      paid: true,
      plan: "yearly",
      yearly_used: 0,
      period_end: "2027-11-02T15:00:00.000Z",
      credits_remaining: 0,
      checks_remaining: 1,
    },
  });
  const headers = { authorization: `Bearer ${TOKEN}`, "x-nf-client-connection-ip": "203.0.113.20" };
  const bodyFor = (id) => JSON.stringify({
    mode: "compare",
    policies: [
      { label: "Life", notes: "Term life." },
      { label: "Pet", notes: "Pet accident." },
    ],
    language: "en",
    country: "United States",
    region: "California",
    explanationId: id,
    comparisonId: id,
  });
  const first = await decode({ httpMethod: "POST", headers, body: bodyFor(randomUUID()) }, accountContext(yearly));
  assert.equal(first.statusCode, 200);
  assert.equal(JSON.parse(first.body).usage.plan, "yearly");
  assert.equal(yearly.snapshot()[USER].yearly_used, 1);
  assert.equal(yearly.snapshot()[USER].checks_remaining, 1);

  await yearly.update(USER, (account) => ({
    write: true,
    account: { ...account, yearly_used: YEARLY_FAIR_USE_LIMIT },
  }));
  const usedCheck = await decode({ httpMethod: "POST", headers, body: bodyFor(randomUUID()) }, accountContext(yearly));
  assert.equal(usedCheck.statusCode, 200);
  assert.equal(JSON.parse(usedCheck.body).usage.kind, "check");
  assert.equal(yearly.snapshot()[USER].yearly_used, YEARLY_FAIR_USE_LIMIT);
  assert.equal(yearly.snapshot()[USER].checks_remaining, 0);

  const stopped = await decode({ httpMethod: "POST", headers, body: bodyFor(randomUUID()) }, accountContext(yearly, {
    fetchImpl: async () => { throw new Error("model should not be called"); },
  }));
  assert.equal(stopped.statusCode, 402);
  assert.equal(JSON.parse(stopped.body).code, "fair_use");
});

test("a failed comparison gives the Household Check back", async (t) => {
  process.env.ANTHROPIC_API_KEY = "test-key";
  const original = globalThis.fetch;
  globalThis.fetch = async () => ({
    ok: false,
    status: 500,
    text: async () => JSON.stringify({ error: { type: "server" } }),
  });
  t.after(() => {
    globalThis.fetch = original;
  });
  const accounts = createMemoryAccountStore({
    [USER]: { paid: true, plan: "household", credits_remaining: 0, checks_remaining: 1 },
  });
  const failed = await decode({
    httpMethod: "POST",
    headers: { authorization: `Bearer ${TOKEN}`, "x-nf-client-connection-ip": "203.0.113.77" },
    body: JSON.stringify({
      mode: "compare",
      policies: [
        { label: "Car", notes: "Liability." },
        { label: "Home", notes: "Fire." },
      ],
      language: "en",
      country: "Canada",
      region: "Alberta",
      explanationId: randomUUID(),
    }),
  }, accountContext(accounts));
  assert.equal(failed.statusCode, 502);
  assert.equal(accounts.snapshot()[USER].checks_remaining, 1);
  assert.equal(accounts.snapshot()[USER].paid, true);
});

test("a long policy is read in parts, and every call shares one comparison", async () => {
  const calls = [];
  const long = `Named insured. Deductible $500. ${"Exclusion at the end of this part. ".repeat(800)}`;
  const request = async (payload) => {
    calls.push(payload);
    if (payload.mode === "compare") {
      return JSON.stringify({
        policies: payload.policies.map((policy) => ({ label: policy.label, summary: `Explains ${policy.label}.` })),
        table: payload.policies.map((policy) => ({
          label: policy.label,
          covered: "Fire",
          limits: "",
          deductible: "$500",
          exclusions: "Flood",
          renewal: "",
        })),
        gaps: "• Flood was not found.",
        overlaps: "",
        questions: ["• What is the deductible?"],
      });
    }
    assert.equal(payload.docText.includes("only the beginning"), false);
    return JSON.stringify({
      coverage: "A part.",
      facts: "• Deductible $500",
      flags: "• An exclusion.",
      questions: "• None in this part.",
      terms: "",
    });
  };

  const outcome = await runComparison({
    policies: [
      { label: "", text: "Short auto policy. Liability $1,000,000. Deductible $500." },
      { label: "Home", text: long },
    ],
    country: "Canada",
    region: "British Columbia",
    language: "en",
    comparisonId: "11111111-1111-4111-8111-111111111112",
    request,
    sleep: async () => {},
  });

  assert.ok(calls.length > 2);
  assert.equal(calls.filter((call) => call.mode === "compare").length, 1);
  assert.ok(calls.filter((call) => call.mode === "extract").length >= 2);
  for (const call of calls) {
    assert.equal(call.explanationId, "11111111-1111-4111-8111-111111111112");
    assert.equal(call.purpose, "compare");
    assert.equal(call.region, "British Columbia");
  }
  assert.equal(outcome.comparison.policies[0].label, "Policy 1");
  assert.equal(outcome.comparison.policies[1].label, "Home");
  assert.match(outcome.comparison.policies[0].summary, /Policy 1/);
  assert.equal(outcome.comparison.rows[0].limits, "Not found in the wording");
  assert.match(outcome.comparison.questions, /deductible/);
  assert.match(outcome.comparison.overlaps, /stood out/);
  assert.ok(outcome.parts > 1);

  const normalized = normalizeComparison({ policies: [], table: [], gaps: "", overlaps: "", questions: "" }, ["Car", "Pet"], "fr");
  assert.equal(normalized.rows[1].deductible, "Pas indiqué dans le texte");
  assert.match(normalized.policies[0].summary, /n'est pas revenue/);

  await assert.rejects(
    () => runComparison({
      policies: [{ label: "Only", text: "One policy." }],
      country: "Canada",
      region: "Ontario",
      language: "es",
      request,
      sleep: async () => {},
    }),
    (err) => err instanceof DecodeError && /2 a 4/.test(err.message),
  );
});

test("the account hint and the check migration stay honest and closed to the browser", () => {
  const hint = planHintText("en", {
    paid: true,
    plan: "household",
    credits_remaining: 2,
    checks_remaining: null,
  });
  assert.match(hint, /1 Household Check/);
  assert.match(hint, /2 Household Check explanations/);
  assert.equal(planHintText("fr", { paid: true, plan: "yearly", period_end: "2027-11-02T00:00:00.000Z", credits_remaining: 0, checks_remaining: 1 }, NOW).includes("Household Check"), true);

  const sql = readFileSync("supabase/migrations/20261103000000_household_checks.sql", "utf8");
  assert.match(sql, /add column if not exists checks_remaining integer/i);
  assert.match(sql, /where checks_remaining is null/i);
  assert.match(sql, /credits_remaining \+ 3\) \/ 4/);
  assert.match(sql, /revoke insert, update, delete on table public\.accounts from public, anon, authenticated/i);
  assert.match(sql, /checks_remaining is null or checks_remaining >= 0/i);
  assert.equal(/grant (all|insert|update|delete)[^;]*to authenticated/i.test(sql), false);
  assert.equal(/doc_text|policy_wording|card_number|comparison_text/i.test(sql), false);
});

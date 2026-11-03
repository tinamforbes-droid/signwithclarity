import assert from "node:assert/strict";
import { createHmac, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";

import { createMemoryAccountStore } from "../shared/accountStore.js";
import { fulfillStripeEvent, noticesFromStripeEvent } from "../shared/billing.js";
import {
  applyCheckout,
  applySubscription,
  decideConsume,
  decideRelease,
  isYearlyActive,
} from "../shared/entitlement.js";
import { handler as checkout } from "../netlify/functions/checkout.js";
import { handler as decode } from "../netlify/functions/decode.js";
import { handler as portal } from "../netlify/functions/portal.js";
import { handler as webhook } from "../netlify/functions/stripe-webhook.js";
import {
  HOUSEHOLD_CHECKS_PER_PURCHASE,
  LEGACY_EXPLANATIONS_PER_CHECK,
  YEARLY_FAIR_USE_LIMIT,
  checkoutReturnOrigin,
  selectPrice,
} from "../shared/plans.js";
import { checkoutSessionParams, clearPriceCache, formEncode, verifyStripeSignature } from "../shared/stripe.js";
import { createMemoryUsageStore } from "../shared/usageGate.js";

const USER = "11111111-1111-4111-8111-111111111111";
const TOKEN = "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1c2VyIn0.signature";
const SECRET = "whsec_test_secret";
const MARKER = "POLICY_SECRET_MARKER_do_not_store";
const NOW = new Date("2026-11-02T15:00:00Z");

function sections() {
  return JSON.stringify({
    summary: "A short summary.",
    flags: "• Nothing surprising.",
    questions: "• What is my deductible?",
    terms: "Deductible: the amount you pay first.",
  });
}

function signed(body, secret = SECRET, seconds = Math.floor(NOW.getTime() / 1000)) {
  const digest = createHmac("sha256", secret).update(`${seconds}.${body}`).digest("hex");
  return `t=${seconds},v1=${digest}`;
}

function accountContext(store, extra = {}) {
  return {
    accountStore: store,
    usageStore: extra.usageStore || createMemoryUsageStore(),
    now: NOW,
    env: {
      STRIPE_SECRET_KEY: "sk_test_example",
      STRIPE_WEBHOOK_SECRET: SECRET,
      VITE_SUPABASE_URL: "https://ldhkqqhlztsaljccazti.supabase.co",
      SUPABASE_SECRET_KEY: "sb_secret_server",
      ...(extra.env || {}),
    },
    verifySession: async () => ({ id: USER, email: "ada@example.com" }),
    fetchImpl: extra.fetchImpl,
    ...extra,
  };
}

test("the plan constants and the price lookup stay with the product", () => {
  assert.equal(HOUSEHOLD_CHECKS_PER_PURCHASE, 1);
  assert.equal(LEGACY_EXPLANATIONS_PER_CHECK, 4);
  assert.equal(YEARLY_FAIR_USE_LIMIT, 100);
  const prices = [
    { id: "price_old", active: false, currency: "cad", product: "prod_VYa35DVVX8zzUK", recurring: null },
    { id: "price_house_usd", active: true, currency: "usd", product: "prod_VYa35DVVX8zzUK", recurring: null },
    { id: "price_house_cad", active: true, currency: "cad", product: "prod_VYa35DVVX8zzUK", recurring: null },
    { id: "price_year_cad", active: true, currency: "cad", product: "prod_VYaEVm0qbwlG00", recurring: { interval: "year" } },
    { id: "price_month", active: true, currency: "cad", product: "prod_VYaEVm0qbwlG00", recurring: { interval: "month" } },
    {
      id: "price_multi",
      active: true,
      currency: "cad",
      product: "prod_VYaEVm0qbwlG00",
      recurring: { interval: "year" },
      currency_options: { usd: { unit_amount: 3900 } },
    },
  ];
  assert.equal(selectPrice(prices, { plan: "household", currency: "cad", product: "prod_VYa35DVVX8zzUK" }).id, "price_house_cad");
  assert.equal(selectPrice(prices, { plan: "household", currency: "usd", product: "prod_VYa35DVVX8zzUK" }).id, "price_house_usd");
  assert.equal(selectPrice(prices, { plan: "yearly", currency: "cad", product: "prod_VYaEVm0qbwlG00" }).id, "price_year_cad");
  assert.equal(selectPrice(prices, { plan: "yearly", currency: "usd", product: "prod_VYaEVm0qbwlG00" }).id, "price_multi");
  assert.equal(selectPrice(prices, { plan: "yearly", currency: "usd", product: "prod_VYaEVm0qbwlG00" }).presentment, "usd");
  assert.equal(checkoutReturnOrigin("https://evil.example/phish"), "https://signwithclarity.ca");
  assert.equal(checkoutReturnOrigin("http://localhost:5173/page"), "http://localhost:5173");
  assert.equal(checkoutReturnOrigin("https://deploy-preview-3--signwithclarity.netlify.app"), "https://deploy-preview-3--signwithclarity.netlify.app");
});

test("a webhook signature must match, and a repeated notice does not add credits twice", async () => {
  const store = createMemoryAccountStore();
  const session = {
    id: "cs_test_1",
    object: "checkout.session",
    mode: "payment",
    payment_status: "paid",
    client_reference_id: USER,
    customer: "cus_123",
    metadata: { user_id: USER, plan: "household" },
  };
  const event = {
    id: "evt_house",
    type: "checkout.session.completed",
    created: 1_762_000_000,
    data: { object: session },
  };
  const body = JSON.stringify(event);
  const good = await webhook({
    httpMethod: "POST",
    headers: { "stripe-signature": signed(body) },
    body,
  }, accountContext(store));
  assert.equal(good.statusCode, 200);
  assert.equal(store.snapshot()[USER].paid, true);
  assert.equal(store.snapshot()[USER].plan, "household");
  assert.equal(store.snapshot()[USER].credits_remaining, 0);
  assert.equal(store.snapshot()[USER].checks_remaining, 1);
  assert.equal(JSON.stringify(store.snapshot()).includes(MARKER), false);

  const again = await webhook({
    httpMethod: "POST",
    headers: { "stripe-signature": signed(body) },
    body,
  }, accountContext(store));
  assert.equal(again.statusCode, 200);
  assert.equal(store.snapshot()[USER].checks_remaining, 1);

  const tampered = await webhook({
    httpMethod: "POST",
    headers: { "stripe-signature": signed(body, "whsec_other") },
    body,
  }, accountContext(store));
  assert.equal(tampered.statusCode, 400);

  const stale = verifyStripeSignature(body, signed(body, SECRET, 1_000), NOW.getTime());
  assert.equal(stale, null);
  const unpaid = noticesFromStripeEvent({
    ...event,
    data: { object: { ...session, payment_status: "unpaid" } },
  });
  assert.deepEqual(unpaid, []);
});

test("a yearly subscription is capped, survives cancel-at-period-end, and ends when Stripe deletes it", async () => {
  const store = createMemoryAccountStore();
  const periodEnd = "2027-11-02T15:00:00.000Z";
  const calls = [];
  const fetchImpl = async (url) => {
    calls.push(String(url));
    assert.equal(String(url).includes("sk_test"), false);
    return {
      ok: true,
      status: 200,
      text: async () => JSON.stringify({
        id: "sub_123",
        status: "active",
        customer: "cus_year",
        current_period_end: Math.floor(Date.parse(periodEnd) / 1000),
        metadata: { user_id: USER, plan: "yearly" },
      }),
    };
  };
  const event = {
    id: "evt_year",
    type: "checkout.session.completed",
    created: 1_762_000_100,
    data: {
      object: {
        id: "cs_year",
        mode: "subscription",
        payment_status: "paid",
        client_reference_id: USER,
        customer: "cus_year",
        subscription: "sub_123",
        metadata: { user_id: USER, plan: "yearly" },
      },
    },
  };
  const body = JSON.stringify(event);
  const opened = await webhook({
    httpMethod: "POST",
    headers: { "stripe-signature": signed(body) },
    body,
  }, accountContext(store, { fetchImpl }));
  assert.equal(opened.statusCode, 200);
  assert.equal(calls.length, 1);
  assert.equal(store.snapshot()[USER].plan, "yearly");
  assert.equal(store.snapshot()[USER].paid, true);
  assert.equal(store.snapshot()[USER].yearly_used, 0);
  assert.equal(isYearlyActive(store.snapshot()[USER], NOW), true);

  store.snapshot();
  await store.update(USER, (account) => ({ write: true, account: { ...account, yearly_used: 40 } }));

  const renewed = {
    id: "evt_renew",
    type: "customer.subscription.updated",
    created: 1_762_000_200,
    data: {
      object: {
        id: "sub_123",
        status: "active",
        customer: "cus_year",
        cancel_at_period_end: true,
        current_period_end: Math.floor(Date.parse("2028-11-02T15:00:00.000Z") / 1000),
        metadata: { user_id: USER },
      },
    },
  };
  await fulfillStripeEvent({ event: renewed, store, env: {}, now: NOW });
  assert.equal(store.snapshot()[USER].paid, true);
  assert.equal(store.snapshot()[USER].yearly_used, 0);
  assert.equal(store.snapshot()[USER].period_end, "2028-11-02T15:00:00.000Z");

  const older = {
    ...renewed,
    id: "evt_old",
    created: 1_762_000_150,
    data: {
      object: {
        ...renewed.data.object,
        status: "canceled",
      },
    },
  };
  await fulfillStripeEvent({ event: older, store, env: {}, now: NOW });
  assert.equal(store.snapshot()[USER].paid, true);

  const ended = {
    id: "evt_end",
    type: "customer.subscription.deleted",
    created: 1_762_000_300,
    data: { object: { id: "sub_123", status: "canceled", customer: "cus_year", metadata: { user_id: USER } } },
  };
  await fulfillStripeEvent({ event: ended, store, env: {}, now: NOW });
  assert.equal(store.snapshot()[USER].paid, false);
  assert.equal(store.snapshot()[USER].plan, null);
  assert.equal(store.snapshot()[USER].stripe_customer_id, "cus_year");
});

test("household credits add up, and a body flag cannot spend or grant them", () => {
  let account = applyCheckout(null, {
    plan: "household",
    userId: USER,
    customerId: "cus_h",
  }, NOW);
  account = applyCheckout(account, { plan: "household", userId: USER, customerId: "cus_h" }, NOW);
  assert.equal(account.checks_remaining, 2);
  assert.equal(account.credits_remaining, 0);

  const first = randomUUID();
  const spent = decideConsume(account, first, NOW, { purpose: "compare" });
  assert.equal(spent.kind, "fresh");
  assert.equal(spent.plan, "check");
  assert.equal(spent.account.checks_remaining, 1);
  const again = decideConsume(spent.account, first, NOW, { purpose: "compare" });
  assert.equal(again.kind, "repeat");
  assert.equal(again.account.checks_remaining, 1);
  const restored = decideRelease(spent.account, first);
  assert.equal(restored.restore, true);
  assert.equal(restored.account.checks_remaining, 2);
  assert.equal(restored.account.paid, true);

  const legacy = { ...account, credits_remaining: 4, checks_remaining: 1 };
  const explained = decideConsume(legacy, randomUUID(), NOW);
  assert.equal(explained.kind, "fresh");
  assert.equal(explained.plan, "household");
  assert.equal(explained.account.credits_remaining, 3);
  assert.equal(explained.account.checks_remaining, 1);

  let yearly = applyCheckout(null, {
    plan: "yearly",
    userId: USER,
    customerId: "cus_y",
    subscriptionId: "sub_y",
    periodEnd: "2027-11-02T15:00:00.000Z",
    created: 10,
  }, NOW);
  yearly.yearly_used = YEARLY_FAIR_USE_LIMIT;
  const blocked = decideConsume(yearly, randomUUID(), NOW);
  assert.equal(blocked.kind, "fair_use");
  assert.equal(blocked.account.yearly_used, YEARLY_FAIR_USE_LIMIT);

  const kept = applySubscription(yearly, {
    status: "active",
    created: 11,
    periodEnd: "2027-11-02T15:00:00.000Z",
    customerId: "cus_y",
    subscriptionId: "sub_y",
  });
  assert.equal(kept.paid, true);
  assert.equal(kept.yearly_used, YEARLY_FAIR_USE_LIMIT);
});

test("checkout requires a real session and asks Stripe for Managed Payments", async () => {
  clearPriceCache();
  const seen = [];
  const fetchImpl = async (url, options) => {
    seen.push({ url: String(url), body: options?.body || "", headers: options?.headers || {} });
    if (String(url).includes("/prices?")) {
      return {
        ok: true,
        text: async () => JSON.stringify({
          data: [{ id: "price_house_cad", active: true, currency: "cad", product: "prod_VYa35DVVX8zzUK", recurring: null }],
        }),
      };
    }
    return {
      ok: true,
      text: async () => JSON.stringify({ id: "cs_1", url: "https://checkout.stripe.com/c/pay/cs_test_123" }),
    };
  };
  const denied = await checkout({
    httpMethod: "POST",
    headers: {},
    body: JSON.stringify({ plan: "household", currency: "cad", language: "fr", docText: MARKER }),
  }, accountContext(createMemoryAccountStore(), { fetchImpl, verifySession: async () => null }));
  assert.equal(denied.statusCode, 401);
  assert.match(JSON.parse(denied.body).error, /courriel/);
  assert.equal(seen.length, 0);

  const opened = await checkout({
    httpMethod: "POST",
    headers: {
      authorization: `Bearer ${TOKEN}`,
      origin: "https://signwithclarity.ca",
    },
    body: JSON.stringify({
      plan: "household",
      currency: "cad",
      language: "en",
      userId: "99999999-9999-4999-8999-999999999999",
      paid: true,
      docText: MARKER,
    }),
  }, accountContext(createMemoryAccountStore(), { fetchImpl }));
  assert.equal(opened.statusCode, 200);
  assert.equal(JSON.parse(opened.body).url, "https://checkout.stripe.com/c/pay/cs_test_123");
  const stripeCall = seen.find((call) => call.url.endsWith("/checkout/sessions"));
  const params = stripeCall.body;
  assert.match(params, /managed_payments(?:%5B|\[)enabled(?:%5D|\])=true/);
  assert.match(params, new RegExp(`client_reference_id=${USER}`));
  assert.match(params, /mode=payment/);
  assert.match(params, /price_house_cad/);
  assert.match(decodeURIComponent(params), /comparison of up to 4 policies/);
  assert.equal(params.includes(MARKER), false);
  assert.equal(params.includes("99999999"), false);
  assert.equal(params.includes("sk_test_example"), false);
  assert.equal(stripeCall.headers.Authorization, "Bearer sk_test_example");
  assert.equal(stripeCall.headers["Stripe-Version"], "2026-04-22.dahlia");
  assert.equal(JSON.parse(opened.body).url.includes("sk_test"), false);

  const yearly = checkoutSessionParams({
    priceId: "price_year",
    plan: "yearly",
    userId: USER,
    origin: "https://signwithclarity.ca",
    customerId: "cus_123",
    email: "ada@example.com",
  });
  const encoded = formEncode(yearly);
  assert.match(encoded, /mode=subscription/);
  assert.match(encoded, /customer=cus_123/);
  assert.equal(encoded.includes("customer_email"), false);
  assert.match(encoded, /subscription_data(?:%5B|\[)metadata(?:%5D|\])(?:%5B|\[)plan(?:%5D|\])=yearly/);
});

test("the customer portal opens only for a yearly plan", async () => {
  const store = createMemoryAccountStore({
    [USER]: {
      paid: true,
      plan: "yearly",
      period_end: "2027-11-02T15:00:00.000Z",
      stripe_customer_id: "cus_year",
      stripe_subscription_id: "sub_123",
      credits_remaining: 0,
      yearly_used: 2,
    },
  });
  let portalBody = "";
  const fetchImpl = async (_url, options) => {
    portalBody = options.body;
    return { ok: true, text: async () => JSON.stringify({ url: "https://billing.stripe.com/p/session/test" }) };
  };
  const opened = await portal({
    httpMethod: "POST",
    headers: { authorization: `Bearer ${TOKEN}`, origin: "https://www.signwithclarity.ca" },
    body: JSON.stringify({ language: "es" }),
  }, accountContext(store, { fetchImpl }));
  assert.equal(opened.statusCode, 200);
  assert.equal(JSON.parse(opened.body).url, "https://billing.stripe.com/p/session/test");
  assert.match(portalBody, /customer=cus_year/);
  assert.match(portalBody, /locale=es/);
  assert.equal(portalBody.includes(MARKER), false);

  const household = createMemoryAccountStore({
    [USER]: { paid: true, plan: "household", credits_remaining: 3, stripe_customer_id: "cus_h" },
  });
  const refused = await portal({
    httpMethod: "POST",
    headers: { authorization: `Bearer ${TOKEN}` },
    body: JSON.stringify({ language: "en" }),
  }, accountContext(household));
  assert.equal(refused.statusCode, 400);
  assert.equal(JSON.parse(refused.body).code, "no_subscription");
});

test("decode spends a household credit once per explanation, then the free limit", async (t) => {
  process.env.ANTHROPIC_API_KEY = "test-key";
  const original = globalThis.fetch;
  globalThis.fetch = async (_url, _options) => ({
    ok: true,
    status: 200,
    text: async () => JSON.stringify({ content: [{ text: sections() }] }),
  });
  t.after(() => {
    globalThis.fetch = original;
  });

  const accounts = createMemoryAccountStore({
    [USER]: { paid: true, plan: "household", credits_remaining: 4 },
  });
  const usage = createMemoryUsageStore();
  const context = accountContext(accounts, { usageStore: usage });
  const id = randomUUID();

  for (const mode of ["extract", "synthesize"]) {
    const response = await decode({
      httpMethod: "POST",
      headers: { authorization: `Bearer ${TOKEN}`, "x-nf-client-connection-ip": "203.0.113.10" },
      body: JSON.stringify({
        mode,
        docText: mode === "synthesize" ? "" : `Hail clause. ${MARKER}`,
        notes: mode === "synthesize" ? "Notes about a deductible." : undefined,
        language: "en",
        country: "Canada",
        region: "Alberta",
        explanationId: id,
        paid: true,
      }),
    }, context);
    assert.equal(response.statusCode, 200, mode);
    assert.equal(JSON.parse(response.body).usage.plan, "household");
    assert.equal(JSON.parse(response.body).usage.remaining, 3);
  }
  assert.equal(accounts.snapshot()[USER].credits_remaining, 3);
  assert.equal(JSON.stringify(usage.snapshot()).includes(MARKER), false);
  assert.equal(JSON.stringify(accounts.snapshot()).includes(MARKER), false);

  for (let n = 0; n < 3; n++) {
    const response = await decode({
      httpMethod: "POST",
      headers: { authorization: `Bearer ${TOKEN}`, "x-nf-client-connection-ip": "203.0.113.10" },
      body: JSON.stringify({
        mode: "single",
        docText: "A short clause.",
        language: "en",
        country: "Canada",
        region: "Alberta",
        explanationId: randomUUID(),
      }),
    }, context);
    assert.equal(response.statusCode, 200);
  }
  assert.equal(accounts.snapshot()[USER].credits_remaining, 0);
  assert.equal(accounts.snapshot()[USER].checks_remaining, 1);
  assert.equal(accounts.snapshot()[USER].paid, true);

  const free = await decode({
    httpMethod: "POST",
    headers: { authorization: `Bearer ${TOKEN}`, "x-nf-client-connection-ip": "203.0.113.10" },
    body: JSON.stringify({
      mode: "single",
      docText: "Another clause.",
      language: "en",
      country: "Canada",
      region: "Alberta",
      explanationId: randomUUID(),
      paid: true,
    }),
  }, context);
  assert.equal(free.statusCode, 200);
  assert.equal(JSON.parse(free.body).usage.plan, undefined);
  assert.equal(JSON.parse(free.body).usage.used, 1);
});

test("a failed reading gives the household credit back, and the yearly cap stops the model", async (t) => {
  process.env.ANTHROPIC_API_KEY = "test-key";
  const original = globalThis.fetch;
  let status = 500;
  globalThis.fetch = async () => ({
    ok: status >= 200 && status < 300,
    status,
    text: async () => JSON.stringify(status === 200 ? { content: [{ text: sections() }] } : { error: { type: "server" } }),
  });
  t.after(() => {
    globalThis.fetch = original;
  });

  const accounts = createMemoryAccountStore({
    [USER]: { paid: true, plan: "household", credits_remaining: 1 },
  });
  const failed = await decode({
    httpMethod: "POST",
    headers: { authorization: `Bearer ${TOKEN}`, "x-nf-client-connection-ip": "203.0.113.44" },
    body: JSON.stringify({
      mode: "single",
      docText: "A short clause.",
      language: "fr",
      country: "Canada",
      region: "Alberta",
      explanationId: randomUUID(),
    }),
  }, accountContext(accounts));
  assert.equal(failed.statusCode, 502);
  assert.equal(accounts.snapshot()[USER].credits_remaining, 1);
  assert.equal(accounts.snapshot()[USER].paid, true);

  status = 200;
  const yearly = createMemoryAccountStore({
    [USER]: {
      paid: true,
      plan: "yearly",
      yearly_used: YEARLY_FAIR_USE_LIMIT,
      period_end: "2027-11-02T15:00:00.000Z",
      credits_remaining: 0,
    },
  });
  const callsBefore = status;
  const blocked = await decode({
    httpMethod: "POST",
    headers: { authorization: `Bearer ${TOKEN}`, "x-nf-client-connection-ip": "203.0.113.44" },
    body: JSON.stringify({
      mode: "single",
      docText: `Do not send. ${MARKER}`,
      language: "en",
      country: "Canada",
      region: "Alberta",
      explanationId: randomUUID(),
      unlimited: true,
    }),
  }, accountContext(yearly, { fetchImpl: async () => { throw new Error("model should not be called"); } }));
  assert.equal(blocked.statusCode, 402);
  assert.equal(JSON.parse(blocked.body).code, "fair_use");
  assert.match(JSON.parse(blocked.body).error, /100 explanations/);
  assert.equal(yearly.snapshot()[USER].yearly_used, YEARLY_FAIR_USE_LIMIT);
  assert.equal(callsBefore, 200);
});

test("the plan migration does not let a signed-in person write paid", () => {
  const sql = readFileSync("supabase/migrations/20261102220000_account_plans.sql", "utf8");
  assert.match(sql, /credits_remaining integer not null default 0/i);
  assert.match(sql, /yearly_used integer not null default 0/i);
  assert.match(sql, /period_end timestamptz/i);
  assert.match(sql, /stripe_customer_id/i);
  assert.match(sql, /explanation_claims jsonb/i);
  assert.match(sql, /create table if not exists public\.billing_events/i);
  assert.match(sql, /enable row level security/i);
  assert.match(sql, /revoke insert, update, delete on table public\.accounts from public, anon, authenticated/i);
  assert.equal(/grant (all|insert|update|delete)[^;]*to authenticated/i.test(sql), false);
  assert.equal(/doc_text|policy_wording|card_number/i.test(sql), false);
});

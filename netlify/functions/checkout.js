// Opens Stripe Checkout. The secret key stays on the server.
// Managed Payments is on, so Stripe is the seller and calculates tax.
//
// Price ids are looked up from the Household Check and Clarity Yearly
// products. Optional overrides, if a lookup ever picks the wrong price:
//   STRIPE_PRICE_HOUSEHOLD_CAD, STRIPE_PRICE_HOUSEHOLD_USD
//   STRIPE_PRICE_YEARLY_CAD, STRIPE_PRICE_YEARLY_USD

import { isPlausibleEmail } from "../../shared/session.js";
import { createSupabaseAccountStore } from "../../shared/accountStore.js";
import {
  checkoutReturnOrigin,
  isCurrency,
  isPlan,
  requestOrigin,
} from "../../shared/plans.js";
import { checkoutSessionParams, createStripeCustomer, findCurrentCustomer, resolvePriceId, stripeRequest } from "../../shared/stripe.js";
import { accountStripeMode, accountWithStripeCustomer, stripeKeyIsLive } from "../../shared/stripeMode.js";
import { failure, jsonReply, languageFrom, readJson, signedInUser } from "../../shared/functionHttp.js";

const LOCALES = { en: "en", fr: "fr", es: "es" };

export async function handler(event, context) {
  const payload = event?.httpMethod === "POST" ? readJson(event) : {};
  const lang = languageFrom(payload);
  if (event?.httpMethod !== "POST") return failure(lang, 405, "errorMethod", "method");
  if (!payload) return failure(lang, 400, "errorBadRequest", "bad_request");

  const plan = payload.plan;
  const currency = payload.currency;
  if (!isPlan(plan) || !isCurrency(currency)) {
    return failure(lang, 400, "errorBadRequest", "bad_plan");
  }

  const { env, user } = await signedInUser(event, context);
  if (!user?.id) return failure(lang, 401, "pricingNeedSignIn", "sign_in");

  const fetchImpl = context?.fetchImpl || globalThis.fetch;
  const origin = checkoutReturnOrigin(requestOrigin(event.headers));
  const live = stripeKeyIsLive(env?.STRIPE_SECRET_KEY);
  const email = isPlausibleEmail(user.email) ? user.email : "";
  let account = null;
  const store = context?.accountStore || createSupabaseAccountStore(env, fetchImpl);
  if (store) {
    try {
      account = await store.get(user.id);
    } catch {
      console.error("account was not read before checkout");
    }
  }

  try {
    const price = await resolvePriceId({ env, plan, currency, fetchImpl });
    if (!price?.id) return failure(lang, 500, "pricingUnavailable", "price");
    const mode = accountStripeMode(account);
    let customerId = mode === (live ? "live" : "test") ? (account?.stripe_customer_id || "") : "";
    if (customerId) customerId = await findCurrentCustomer({ env, fetchImpl, customerId });
    if (!customerId) customerId = await createStripeCustomer({ env, fetchImpl, email, userId: user.id });
    if (store && customerId && customerId !== account?.stripe_customer_id) {
      try {
        await store.update(user.id, (current) => ({
          write: true,
          account: accountWithStripeCustomer(current, customerId, live),
        }));
      } catch {
        console.error("stripe customer was not saved");
      }
    }
    const sessionParams = {
      priceId: price.id,
      plan,
      currency: price.presentment,
      userId: user.id,
      email,
      customerId,
      origin,
      locale: LOCALES[lang] || "en",
    };
    let session;
    try {
      session = await stripeRequest({
        env,
        path: "/checkout/sessions",
        method: "POST",
        fetchImpl,
        params: checkoutSessionParams(sessionParams),
      });
    } catch (err) {
      if (err?.stripeCode !== "resource_missing" || !customerId) throw err;
      session = await stripeRequest({
        env,
        path: "/checkout/sessions",
        method: "POST",
        fetchImpl,
        params: checkoutSessionParams({ ...sessionParams, customerId: "" }),
      });
    }
    if (!session?.url || typeof session.url !== "string") {
      return failure(lang, 502, "pricingFailed", "checkout");
    }
    return jsonReply(200, { url: session.url });
  } catch (err) {
    console.error("checkout was not opened", err?.code || "error");
    if (err?.code === "stripe_not_configured") return failure(lang, 500, "pricingUnavailable", "stripe");
    return failure(lang, 502, "pricingFailed", "checkout");
  }
}

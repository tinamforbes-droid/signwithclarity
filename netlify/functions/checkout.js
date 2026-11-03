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
import { checkoutSessionParams, resolvePriceId, stripeRequest } from "../../shared/stripe.js";
import { t } from "../../shared/messages.js";
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
  let customerId = "";
  const store = context?.accountStore || createSupabaseAccountStore(env, fetchImpl);
  if (store) {
    try {
      const account = await store.get(user.id);
      customerId = account?.stripe_customer_id || "";
    } catch {
      console.error("account was not read before checkout");
    }
  }

  try {
    const price = await resolvePriceId({ env, plan, currency, fetchImpl });
    if (!price?.id) return failure(lang, 500, "pricingUnavailable", "price");
    const email = !customerId && isPlausibleEmail(user.email) ? user.email : "";
    const session = await stripeRequest({
      env,
      path: "/checkout/sessions",
      method: "POST",
      fetchImpl,
      params: checkoutSessionParams({
        priceId: price.id,
        plan,
        currency: price.presentment,
        userId: user.id,
        email,
        customerId,
        origin,
        locale: LOCALES[lang] || "en",
        submitMessage: t(lang, plan === "yearly" ? "checkoutYearlyNote" : "checkoutHouseholdNote"),
      }),
    });
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

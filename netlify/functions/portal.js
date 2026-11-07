// Opens Stripe's customer portal so a yearly subscriber can manage or cancel.
// The secret key stays on the server. The browser only receives the portal URL.

import { createSupabaseAccountStore } from "../../shared/accountStore.js";
import { checkoutReturnOrigin, requestOrigin } from "../../shared/plans.js";
import { createStripeCustomer, findCurrentCustomer, stripeRequest } from "../../shared/stripe.js";
import { accountWithStripeCustomer, projectAccountForStripeMode, stripeKeyIsLive } from "../../shared/stripeMode.js";
import { isPlausibleEmail } from "../../shared/session.js";
import { failure, jsonReply, languageFrom, readJson, signedInUser } from "../../shared/functionHttp.js";

export async function handler(event, context) {
  const payload = event?.httpMethod === "POST" ? readJson(event) : {};
  const lang = languageFrom(payload);
  if (event?.httpMethod !== "POST") return failure(lang, 405, "errorMethod", "method");
  if (payload == null) return failure(lang, 400, "errorBadRequest", "bad_request");

  const { env, user } = await signedInUser(event, context);
  if (!user?.id) return failure(lang, 401, "pricingNeedSignIn", "sign_in");

  const fetchImpl = context?.fetchImpl || globalThis.fetch;
  const store = context?.accountStore || createSupabaseAccountStore(env, fetchImpl);
  if (!store) return failure(lang, 500, "pricingUnavailable", "account");

  let account;
  try {
    account = await store.get(user.id);
  } catch {
    console.error("account was not read before the portal");
    return failure(lang, 503, "pricingManageFailed", "account");
  }

  const live = stripeKeyIsLive(env?.STRIPE_SECRET_KEY);
  const viewed = projectAccountForStripeMode(account, live);
  const yearly = viewed?.plan === "yearly" && viewed?.paid === true;
  if (!yearly) return failure(lang, 400, "pricingNoSubscription", "no_subscription");

  try {
    let customerId = await findCurrentCustomer({
      env,
      fetchImpl,
      customerId: viewed.stripe_customer_id,
    });
    if (!customerId) {
      const email = isPlausibleEmail(user.email) ? user.email : "";
      customerId = await createStripeCustomer({ env, fetchImpl, email, userId: user.id });
      if (customerId) {
        try {
          await store.update(user.id, (current) => ({
            write: true,
            account: accountWithStripeCustomer(current, customerId, live),
          }));
        } catch {
          console.error("stripe customer was not saved");
        }
      }
    }
    if (!customerId) return failure(lang, 502, "pricingManageFailed", "portal");
    const session = await stripeRequest({
      env,
      path: "/billing_portal/sessions",
      method: "POST",
      fetchImpl,
      params: {
        customer: customerId,
        return_url: `${checkoutReturnOrigin(requestOrigin(event.headers))}/#pricing`,
        locale: lang === "fr" ? "fr" : lang === "es" ? "es" : "en",
      },
    });
    if (!session?.url || typeof session.url !== "string") {
      return failure(lang, 502, "pricingManageFailed", "portal");
    }
    return jsonReply(200, { url: session.url });
  } catch (err) {
    console.error("portal was not opened", err?.code || "error");
    return failure(lang, 502, "pricingManageFailed", "portal");
  }
}

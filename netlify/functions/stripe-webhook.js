// Stripe tells this function when a payment succeeds, when a yearly plan
// renews, and when a yearly plan ends. The notice is checked with
// STRIPE_WEBHOOK_SECRET before any account row changes.
//
// Subscribe the endpoint to:
//   checkout.session.completed
//   checkout.session.async_payment_succeeded
//   checkout.session.async_payment_failed
//   customer.subscription.updated
//   customer.subscription.deleted

import { createSupabaseAccountStore } from "../../shared/accountStore.js";
import { fulfillStripeEvent } from "../../shared/billing.js";
import { jsonReply, serverEnv } from "../../shared/functionHttp.js";
import { rawEventBody, stripeSignatureHeader, verifyStripeSignature } from "../../shared/stripe.js";

export async function handler(event, context) {
  if (event?.httpMethod !== "POST") {
    return jsonReply(405, { error: "That request wasn't accepted." });
  }

  const env = serverEnv(context);
  const raw = rawEventBody(event);
  const verified = verifyStripeSignature(
    raw,
    stripeSignatureHeader(event.headers),
    env.STRIPE_WEBHOOK_SECRET,
    context?.now instanceof Date ? context.now.getTime() : Date.now(),
  );
  if (!verified?.id || !verified.type) {
    return jsonReply(400, { error: "The notice could not be verified." });
  }

  const fetchImpl = context?.fetchImpl || globalThis.fetch;
  const store = context?.accountStore || createSupabaseAccountStore(env, fetchImpl);
  if (!store) return jsonReply(500, { error: "The account store is not configured." });

  try {
    await fulfillStripeEvent({
      event: verified,
      store,
      env,
      fetchImpl,
      now: context?.now instanceof Date ? context.now : new Date(),
    });
  } catch (err) {
    console.error("stripe notice was not applied", verified.type, verified.id, err?.code || "error");
    return jsonReply(500, { error: "The notice could not be recorded." });
  }

  return jsonReply(200, { received: true });
}

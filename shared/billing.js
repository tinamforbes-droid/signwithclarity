import { isUserId } from "./session.js";
import {
  applyCheckout,
  applySubscription,
  fallbackPeriodEnd,
  stripeId,
  subscriptionPeriodEndIso,
} from "./entitlement.js";
import { stripeRequest } from "./stripe.js";

export function noticesFromStripeEvent(event, extras = {}) {
  const type = event?.type;
  const object = event?.data?.object || {};
  if (type === "checkout.session.completed" || type === "checkout.session.async_payment_succeeded") {
    const paid = type === "checkout.session.async_payment_succeeded" || object.payment_status === "paid";
    if (!paid) return [];
    const plan = object.metadata?.plan;
    const userId = String(object.client_reference_id || object.metadata?.user_id || "").trim().toLowerCase();
    if (plan === "household" && object.mode !== "payment") return [];
    if (plan === "yearly" && object.mode !== "subscription") return [];
    if (plan !== "household" && plan !== "yearly") return [];
    if (!isUserId(userId)) return [];
    return [{
      kind: "checkout",
      plan,
      userId,
      customerId: stripeId(object.customer),
      subscriptionId: stripeId(object.subscription),
      periodEnd: extras.periodEnd || "",
      created: event.created,
    }];
  }
  if (type === "customer.subscription.updated" || type === "customer.subscription.deleted") {
    const userId = String(object.metadata?.user_id || "").trim().toLowerCase();
    return [{
      kind: "subscription",
      userId: isUserId(userId) ? userId : "",
      customerId: stripeId(object.customer),
      subscriptionId: stripeId(object.id),
      status: type === "customer.subscription.deleted" ? "canceled" : String(object.status || ""),
      deleted: type === "customer.subscription.deleted",
      periodEnd: subscriptionPeriodEndIso(object),
      created: event.created,
    }];
  }
  return [];
}

async function accountForNotice(store, notice) {
  if (isUserId(notice.userId)) return notice.userId;
  if (notice.subscriptionId && store.findBySubscription) {
    const row = await store.findBySubscription(notice.subscriptionId);
    if (isUserId(row?.user_id)) return row.user_id;
  }
  if (notice.customerId && store.findByCustomer) {
    const row = await store.findByCustomer(notice.customerId);
    if (isUserId(row?.user_id)) return row.user_id;
  }
  if (notice.kind === "subscription") {
    const error = new Error("subscription account was not found");
    error.code = "account_missing";
    throw error;
  }
  return "";
}

export async function fulfillStripeEvent({ event, store, env, fetchImpl = fetch, now = new Date() } = {}) {
  if (!event?.id || !store) {
    const error = new Error("webhook was incomplete");
    error.code = "webhook_incomplete";
    throw error;
  }
  const claimed = await store.claimEvent(event.id, event.type);
  if (!claimed) return { duplicate: true };

  try {
    let periodEnd = "";
    const session = event.data?.object || {};
    const subscriptionId = stripeId(session.subscription);
    if (
      (event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded")
      && session.mode === "subscription"
      && subscriptionId
    ) {
      try {
        const subscription = await stripeRequest({
          env,
          path: `/subscriptions/${encodeURIComponent(subscriptionId)}`,
          fetchImpl,
        });
        periodEnd = subscriptionPeriodEndIso(subscription);
      } catch {
        console.error("stripe subscription period was not read");
        periodEnd = fallbackPeriodEnd(now);
      }
    }

    const notices = noticesFromStripeEvent(event, { periodEnd });
    for (const notice of notices) {
      const userId = await accountForNotice(store, notice);
      if (!userId) continue;
      await store.update(userId, (account) => {
        const next = notice.kind === "checkout"
          ? applyCheckout(account, notice, now)
          : applySubscription(account, notice);
        if (!next) return { write: false };
        return { write: true, account: { ...next, user_id: userId } };
      });
    }
    return { ok: true };
  } catch (err) {
    try {
      await store.releaseEvent?.(event.id);
    } catch {
      console.error("stripe event lock was not released");
    }
    throw err;
  }
}

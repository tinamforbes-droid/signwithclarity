import { MAX_CALLS_PER_EXPLANATION } from "./usageCopy.js";
import { HOUSEHOLD_EXPLANATION_CREDITS, YEARLY_FAIR_USE_LIMIT } from "./plans.js";

const ACTIVE_SUBSCRIPTION = new Set(["active", "trialing", "past_due"]);
const ENDED_SUBSCRIPTION = new Set(["canceled", "unpaid", "incomplete_expired"]);

export function blankAccount(userId, email = null) {
  return {
    user_id: userId,
    email: email || null,
    paid: false,
    plan: null,
    credits_remaining: 0,
    yearly_used: 0,
    period_end: null,
    stripe_customer_id: null,
    stripe_subscription_id: null,
    explanation_claims: {},
    subscription_synced_at: null,
  };
}

export function claimCount(claims, explanationId) {
  const entry = claims?.[explanationId];
  const n = Number(entry?.n);
  return Number.isInteger(n) && n > 0 ? n : 0;
}

export function withoutPlan(claims, plan) {
  const out = {};
  for (const [id, entry] of Object.entries(claims || {})) {
    if (entry?.plan === plan) continue;
    out[id] = entry;
  }
  return out;
}

export function isYearlyActive(account, now) {
  if (!account || account.plan !== "yearly" || account.paid !== true) return false;
  const end = Date.parse(account.period_end || "");
  return Number.isFinite(end) && end > now.getTime();
}

export function isHouseholdActive(account) {
  if (!account || account.plan !== "household" || account.paid !== true) return false;
  return (account.credits_remaining || 0) > 0;
}

function withClaim(account, explanationId, plan, n) {
  return {
    ...account,
    explanation_claims: {
      ...(account.explanation_claims || {}),
      [explanationId]: { n, plan },
    },
  };
}

/**
 * Count one explanation against the paid plan, or say there is no paid plan.
 * An explanation id that already started does not spend a second credit.
 * Nothing in here reads a flag from the request body.
 */
export function decideConsume(account, explanationId, now, limits = {}) {
  const yearlyCap = limits.yearlyCap || YEARLY_FAIR_USE_LIMIT;
  const maxCalls = limits.maxCalls || MAX_CALLS_PER_EXPLANATION;
  const current = account || blankAccount("");
  const existing = claimCount(current.explanation_claims, explanationId);
  if (existing > 0) {
    if (existing >= maxCalls) return { kind: "closed", account: current };
    return {
      kind: "repeat",
      plan: current.explanation_claims[explanationId].plan,
      account: withClaim(current, explanationId, current.explanation_claims[explanationId].plan, existing + 1),
    };
  }

  if (isYearlyActive(current, now)) {
    if ((current.yearly_used || 0) >= yearlyCap) return { kind: "fair_use", account: current };
    return {
      kind: "fresh",
      plan: "yearly",
      account: withClaim(
        { ...current, yearly_used: (current.yearly_used || 0) + 1 },
        explanationId,
        "yearly",
        1,
      ),
    };
  }

  if (isHouseholdActive(current)) {
    const credits = current.credits_remaining - 1;
    const next = withClaim(
      {
        ...current,
        credits_remaining: credits,
        paid: credits > 0,
        plan: credits > 0 ? "household" : null,
      },
      explanationId,
      "household",
      1,
    );
    return { kind: "fresh", plan: "household", account: next };
  }

  return { kind: "none", account: current };
}

/** Give back a credit when the first call for that explanation failed. */
export function decideRelease(account, explanationId) {
  const current = account || blankAccount("");
  const entry = current.explanation_claims?.[explanationId];
  if (!entry || entry.n !== 1) return { restore: false, account: current };
  const claims = { ...current.explanation_claims };
  delete claims[explanationId];
  if (entry.plan === "yearly") {
    return {
      restore: true,
      account: {
        ...current,
        explanation_claims: claims,
        yearly_used: Math.max(0, (current.yearly_used || 0) - 1),
      },
    };
  }
  if (entry.plan === "household") {
    const credits = (current.credits_remaining || 0) + 1;
    const keepYearly = current.plan === "yearly";
    return {
      restore: true,
      account: {
        ...current,
        explanation_claims: claims,
        credits_remaining: credits,
        plan: keepYearly ? "yearly" : "household",
        paid: keepYearly ? current.paid : true,
      },
    };
  }
  return { restore: false, account: current };
}

export function paidUsage(account, plan) {
  if (plan === "household") {
    return {
      limited: true,
      plan: "household",
      remaining: Math.max(0, account?.credits_remaining || 0),
    };
  }
  const used = Math.max(0, account?.yearly_used || 0);
  return {
    limited: true,
    plan: "yearly",
    limit: YEARLY_FAIR_USE_LIMIT,
    used,
    remaining: Math.max(0, YEARLY_FAIR_USE_LIMIT - used),
    resetsOn: isoDate(account?.period_end),
  };
}

export function isoDate(value) {
  const parsed = Date.parse(value || "");
  if (!Number.isFinite(parsed)) return "";
  return new Date(parsed).toISOString().slice(0, 10);
}

export function subscriptionPeriodEndIso(subscription) {
  const unix = subscription?.current_period_end
    || subscription?.items?.data?.[0]?.current_period_end
    || null;
  const seconds = Number(unix);
  if (!Number.isFinite(seconds) || seconds <= 0) return "";
  return new Date(seconds * 1000).toISOString();
}

export function fallbackPeriodEnd(now) {
  const next = new Date(now.getTime());
  next.setUTCFullYear(next.getUTCFullYear() + 1);
  return next.toISOString();
}

export function stripeId(value) {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (value && typeof value === "object" && typeof value.id === "string") return value.id.trim();
  return "";
}

function syncedAt(created) {
  const seconds = Number(created);
  if (!Number.isFinite(seconds) || seconds <= 0) return null;
  return new Date(seconds * 1000).toISOString();
}

function isOlderNotice(account, created) {
  if (!created || !account?.subscription_synced_at) return false;
  const prev = Date.parse(account.subscription_synced_at);
  return Number.isFinite(prev) && created * 1000 < prev;
}

export function applyCheckout(account, notice, now) {
  const base = account || blankAccount(notice.userId);
  if (notice.plan === "household") {
    const credits = (base.credits_remaining || 0) + HOUSEHOLD_EXPLANATION_CREDITS;
    const yearly = isYearlyActive(base, now);
    return {
      ...base,
      credits_remaining: credits,
      stripe_customer_id: notice.customerId || base.stripe_customer_id,
      plan: yearly ? "yearly" : "household",
      paid: true,
    };
  }
  if (notice.plan === "yearly") {
    return {
      ...base,
      plan: "yearly",
      paid: true,
      yearly_used: 0,
      explanation_claims: withoutPlan(base.explanation_claims, "yearly"),
      period_end: notice.periodEnd || fallbackPeriodEnd(now),
      stripe_customer_id: notice.customerId || base.stripe_customer_id,
      stripe_subscription_id: notice.subscriptionId || base.stripe_subscription_id,
      subscription_synced_at: syncedAt(notice.created) || base.subscription_synced_at,
    };
  }
  return null;
}

function endYearly(account, synced) {
  const credits = account.credits_remaining || 0;
  return {
    ...account,
    plan: credits > 0 ? "household" : null,
    paid: credits > 0,
    period_end: null,
    yearly_used: 0,
    stripe_subscription_id: null,
    subscription_synced_at: synced || account.subscription_synced_at,
  };
}

export function applySubscription(account, notice) {
  const base = account || blankAccount(notice.userId);
  if (isOlderNotice(base, notice.created)) return null;
  const synced = syncedAt(notice.created) || base.subscription_synced_at;
  if (notice.deleted || ENDED_SUBSCRIPTION.has(notice.status)) {
    return endYearly(base, synced);
  }
  if (!ACTIVE_SUBSCRIPTION.has(notice.status)) return null;
  const prevEnd = Date.parse(base.period_end || "");
  const nextEnd = Date.parse(notice.periodEnd || "");
  const renewed = Number.isFinite(prevEnd) && Number.isFinite(nextEnd) && nextEnd > prevEnd;
  return {
    ...base,
    plan: "yearly",
    paid: true,
    period_end: notice.periodEnd || base.period_end,
    stripe_customer_id: notice.customerId || base.stripe_customer_id,
    stripe_subscription_id: notice.subscriptionId || base.stripe_subscription_id,
    yearly_used: renewed ? 0 : (base.yearly_used || 0),
    explanation_claims: renewed ? withoutPlan(base.explanation_claims, "yearly") : (base.explanation_claims || {}),
    subscription_synced_at: synced,
  };
}

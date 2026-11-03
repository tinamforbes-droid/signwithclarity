import { MAX_CALLS_PER_COMPARISON, MAX_CALLS_PER_EXPLANATION } from "./usageCopy.js";
import {
  HOUSEHOLD_CHECKS_PER_PURCHASE,
  LEGACY_EXPLANATIONS_PER_CHECK,
  YEARLY_FAIR_USE_LIMIT,
} from "./plans.js";

const ACTIVE_SUBSCRIPTION = new Set(["active", "trialing", "past_due"]);
const ENDED_SUBSCRIPTION = new Set(["canceled", "unpaid", "incomplete_expired"]);

export function blankAccount(userId, email = null) {
  return {
    user_id: userId,
    email: email || null,
    paid: false,
    plan: null,
    credits_remaining: 0,
    checks_remaining: null,
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

/**
 * Household Checks left. A null balance is an older row that still
 * counts single explanations: one check for every four, rounded up.
 * A number, including zero, is already converted and is left as it is.
 */
export function visibleChecks(account) {
  if (!account) return 0;
  if (Number.isInteger(account.checks_remaining)) return Math.max(0, account.checks_remaining);
  const credits = Math.max(0, account.credits_remaining || 0);
  if (credits <= 0) return 0;
  return Math.ceil(credits / LEGACY_EXPLANATIONS_PER_CHECK);
}

export function migrateChecks(account) {
  if (!account) return { account: null, migrated: false };
  if (Number.isInteger(account.checks_remaining)) return { account, migrated: false };
  return {
    migrated: true,
    account: { ...account, checks_remaining: visibleChecks(account) },
  };
}

export function canCompareAccount(account, now = new Date()) {
  if (!account) return false;
  const checks = visibleChecks(account);
  if (isYearlyActive(account, now)) {
    if ((account.yearly_used || 0) < YEARLY_FAIR_USE_LIMIT) return true;
    return checks > 0;
  }
  return checks > 0;
}

function householdStanding(account, credits, checks) {
  if (account.plan === "yearly" && account.paid === true) {
    return { plan: "yearly", paid: true };
  }
  const keep = credits > 0 || checks > 0;
  return { plan: keep ? "household" : null, paid: keep };
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

function claimPlan(entry) {
  return entry?.plan === "check" || entry?.plan === "yearly" || entry?.plan === "household"
    ? entry.plan
    : "household";
}

/**
 * Count one explanation, or one comparison, against the paid plan.
 * An id that already started does not spend a second time.
 * Nothing in here reads a flag from the request body.
 *
 * A comparison spends one Household Check, or one Clarity Yearly
 * explanation. The policies inside that comparison share the id.
 * Older single-explanation credits are spent only by a single explanation.
 */
export function decideConsume(account, explanationId, now, limits = {}) {
  const yearlyCap = limits.yearlyCap || YEARLY_FAIR_USE_LIMIT;
  const purpose = limits.purpose === "compare" ? "compare" : "explain";
  const hadRow = Boolean(account);
  const { account: migrated, migrated: didMigrate } = migrateChecks(account || blankAccount(""));
  const persist = hadRow && didMigrate;
  const current = migrated;
  const existing = claimCount(current.explanation_claims, explanationId);
  const existingPlan = claimPlan(current.explanation_claims?.[explanationId]);
  const maxCalls = existingPlan === "check" || purpose === "compare"
    ? (limits.maxCalls || MAX_CALLS_PER_COMPARISON)
    : (limits.maxCalls || MAX_CALLS_PER_EXPLANATION);

  if (existing > 0) {
    if (existing >= maxCalls) return { kind: "closed", account: current, migrated: persist };
    return {
      kind: "repeat",
      plan: existingPlan,
      migrated: persist,
      account: withClaim(current, explanationId, existingPlan, existing + 1),
    };
  }

  if (isYearlyActive(current, now) && (current.yearly_used || 0) < yearlyCap) {
    return {
      kind: "fresh",
      plan: "yearly",
      migrated: persist,
      account: withClaim(
        { ...current, yearly_used: (current.yearly_used || 0) + 1 },
        explanationId,
        "yearly",
        1,
      ),
    };
  }

  if (purpose === "compare" && (current.checks_remaining || 0) > 0) {
    const checks = current.checks_remaining - 1;
    const credits = current.credits_remaining || 0;
    const standing = householdStanding(current, credits, checks);
    return {
      kind: "fresh",
      plan: "check",
      migrated: persist,
      account: withClaim(
        { ...current, checks_remaining: checks, ...standing },
        explanationId,
        "check",
        1,
      ),
    };
  }

  if (isYearlyActive(current, now)) {
    return { kind: "fair_use", account: current, migrated: persist };
  }

  if (purpose === "compare") {
    return { kind: "needs_plan", account: current, migrated: persist };
  }

  if (isHouseholdActive(current)) {
    const credits = current.credits_remaining - 1;
    const checks = current.checks_remaining || 0;
    const standing = householdStanding(current, credits, checks);
    return {
      kind: "fresh",
      plan: "household",
      migrated: persist,
      account: withClaim(
        { ...current, credits_remaining: credits, ...standing },
        explanationId,
        "household",
        1,
      ),
    };
  }

  return { kind: "none", account: current, migrated: persist };
}

/** Give back a credit when the first call for that explanation failed. */
export function decideRelease(account, explanationId) {
  const { account: current } = migrateChecks(account || blankAccount(""));
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
  if (entry.plan === "household" || entry.plan === "check") {
    const checks = (current.checks_remaining || 0) + (entry.plan === "check" ? 1 : 0);
    const credits = (current.credits_remaining || 0) + (entry.plan === "household" ? 1 : 0);
    const standing = householdStanding(current, credits, checks);
    return {
      restore: true,
      account: {
        ...current,
        explanation_claims: claims,
        credits_remaining: credits,
        checks_remaining: checks,
        ...standing,
      },
    };
  }
  return { restore: false, account: current };
}

export function paidUsage(account, plan) {
  if (plan === "check") {
    return {
      limited: true,
      plan: "household",
      kind: "check",
      remaining: Math.max(0, account?.checks_remaining || 0),
      checks: Math.max(0, account?.checks_remaining || 0),
      explanations: Math.max(0, account?.credits_remaining || 0),
    };
  }
  if (plan === "household") {
    return {
      limited: true,
      plan: "household",
      kind: "explanation",
      remaining: Math.max(0, account?.credits_remaining || 0),
      checks: Math.max(0, account?.checks_remaining || 0),
      explanations: Math.max(0, account?.credits_remaining || 0),
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
    const { account: migrated } = migrateChecks(base);
    const checks = (migrated.checks_remaining || 0) + HOUSEHOLD_CHECKS_PER_PURCHASE;
    const yearly = isYearlyActive(migrated, now);
    return {
      ...migrated,
      checks_remaining: checks,
      stripe_customer_id: notice.customerId || migrated.stripe_customer_id,
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
  const { account: migrated } = migrateChecks(account);
  const credits = migrated.credits_remaining || 0;
  const checks = migrated.checks_remaining || 0;
  const keep = credits > 0 || checks > 0;
  return {
    ...migrated,
    plan: keep ? "household" : null,
    paid: keep,
    period_end: null,
    yearly_used: 0,
    stripe_subscription_id: null,
    subscription_synced_at: synced || migrated.subscription_synced_at,
  };
}

export function applySubscription(account, notice) {
  const { account: base } = migrateChecks(account || blankAccount(notice.userId));
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

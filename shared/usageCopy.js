import { t } from "./messages.js";

/** Free document explanations in one UTC calendar month, in Canada and the United States. */
export const FREE_EXPLANATION_LIMIT = 3;

/**
 * Free explanations for someone outside Canada and the United States.
 * One try in total. It does not reset when the month changes.
 */
export const GENERAL_FREE_LIMIT = 1;

/**
 * How many different signed-in accounts may start a General free
 * explanation from one connection in a UTC day. This does not spend
 * anyone's free try. It only slows a burst of new accounts.
 */
export const GENERAL_SIGNUPS_PER_IP_PER_DAY = 20;

/**
 * Most model calls one explanation may use, including parts and a retry.
 * A long document is still one explanation. The cap stops one id from
 * being reused for a fresh document over and over.
 */
export const MAX_CALLS_PER_EXPLANATION = 120;

/**
 * A comparison reads up to four policies, each in parts, then writes
 * one result. The cap is higher than a single explanation so a long
 * policy is not cut off, and it still stops one id from being reused
 * for comparison after comparison.
 */
export const MAX_CALLS_PER_COMPARISON = 480;

/** UTC calendar day, as YYYY-MM-DD. */
export function dayKey(date) {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function monthKey(date) {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

/** First day of the next UTC month, as YYYY-MM-DD. */
export function resetsOnIso(date) {
  const next = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1));
  const year = next.getUTCFullYear();
  const month = String(next.getUTCMonth() + 1).padStart(2, "0");
  const day = String(next.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function formatResetDate(iso, lang) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || ""));
  if (!match) return "";
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  const locale = lang === "fr" ? "fr-CA" : lang === "es" ? "es-419" : "en-CA";
  return new Intl.DateTimeFormat(locale, {
    timeZone: "UTC",
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(date);
}

export function usageSnapshot(record, resetsOn, options = {}) {
  const limit = Number.isInteger(options.limit) ? options.limit : FREE_EXPLANATION_LIMIT;
  const used = Number.isInteger(record?.used) && record.used > 0 ? record.used : 0;
  const snapshot = {
    limited: true,
    limit,
    used,
    remaining: Math.max(0, limit - used),
  };
  if (options.once) {
    snapshot.once = true;
    return snapshot;
  }
  snapshot.resetsOn = resetsOn;
  return snapshot;
}

/**
 * A free General try and the Canada/US monthly count are separate.
 * A paid plan still shows in either place.
 */
export function usageAppliesHere(usage, general) {
  if (!usage?.limited) return false;
  if (usage.plan === "yearly" || usage.plan === "household") return true;
  if (general) return usage.once === true;
  return usage.once !== true;
}

/** Calm line for the page. Empty when this visitor is not on a counted plan. */
export function usageStatusMessage(lang, usage) {
  if (!usage?.limited) return "";
  if (usage.plan === "household") {
    const count = usage.remaining ?? 0;
    if (count <= 0) return "";
    if (usage.kind === "check") {
      if (count === 1) return t(lang, "householdCheckRemainingOne");
      return t(lang, "householdCheckRemaining", { count });
    }
    if (count === 1) return t(lang, "householdRemainingOne");
    return t(lang, "householdRemaining", { count });
  }
  if (usage.once) {
    if ((usage.remaining ?? 0) <= 0) return t(lang, "generalFreeUsed");
    return t(lang, "generalFreeRemaining");
  }
  const date = formatResetDate(usage.resetsOn, lang);
  if (!date) return "";
  if (usage.plan === "yearly") {
    if ((usage.remaining ?? 0) <= 0) return t(lang, "fairUseReached", { date });
    if (usage.remaining === 1) return t(lang, "yearlyRemainingOne", { date });
    return t(lang, "yearlyRemaining", { count: usage.remaining, date });
  }
  if ((usage.remaining ?? 0) <= 0) return t(lang, "freeLimitReached", { date });
  if (usage.remaining === 1) return t(lang, "freeRemainingOne", { date });
  return t(lang, "freeRemaining", { count: usage.remaining, date });
}

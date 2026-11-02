import { t } from "./messages.js";

/** Free document explanations in one UTC calendar month. */
export const FREE_EXPLANATION_LIMIT = 3;

/**
 * Most model calls one explanation may use, including parts and a retry.
 * A long document is still one explanation. The cap stops one id from
 * being reused for a fresh document over and over.
 */
export const MAX_CALLS_PER_EXPLANATION = 120;

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

export function usageSnapshot(record, resetsOn) {
  const used = Number.isInteger(record?.used) && record.used > 0 ? record.used : 0;
  return {
    limited: true,
    limit: FREE_EXPLANATION_LIMIT,
    used,
    remaining: Math.max(0, FREE_EXPLANATION_LIMIT - used),
    resetsOn,
  };
}

/** Calm line for the page. Empty when this visitor is not on the free limit. */
export function usageStatusMessage(lang, usage) {
  if (!usage?.limited) return "";
  const date = formatResetDate(usage.resetsOn, lang);
  if (!date) return "";
  if ((usage.remaining ?? 0) <= 0) return t(lang, "freeLimitReached", { date });
  if (usage.remaining === 1) return t(lang, "freeRemainingOne", { date });
  return t(lang, "freeRemaining", { count: usage.remaining, date });
}

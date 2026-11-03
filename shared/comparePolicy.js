import { t } from "./messages.js";
import { MAX_NOTES_CHARS, MAX_SERVER_NOTES, normalizeDocument } from "./limits.js";
import { MAX_COMPARE_POLICIES, MIN_COMPARE_POLICIES } from "./plans.js";

const LABEL_LIMIT = 40;

export function isComparisonRequest(payload) {
  if (!payload || typeof payload !== "object") return false;
  if (payload.mode === "compare") return true;
  return payload.purpose === "compare" && (payload.mode === "extract" || payload.mode === "reduce");
}

export function policyLabel(lang, label, index) {
  const cleaned = String(label ?? "").replace(/[\r\n]+/g, " ").trim().slice(0, LABEL_LIMIT);
  if (cleaned) return cleaned;
  return t(lang, "policyLabelDefault", { count: index + 1 });
}

/**
 * Notes for the comparison call. The documents themselves are not accepted here.
 * Returns { ok, policies } or { ok: false, reason }.
 */
export function cleanComparisonPolicies(value, lang = "en") {
  if (!Array.isArray(value)) return { ok: false, reason: "count" };
  if (value.length < MIN_COMPARE_POLICIES || value.length > MAX_COMPARE_POLICIES) {
    return { ok: false, reason: "count" };
  }
  const policies = [];
  let total = 0;
  for (let index = 0; index < value.length; index++) {
    const item = value[index];
    const notes = normalizeDocument(item?.notes);
    if (!notes) return { ok: false, reason: "empty" };
    if (notes.length > MAX_NOTES_CHARS) return { ok: false, reason: "notes" };
    total += notes.length;
    if (total > MAX_SERVER_NOTES) return { ok: false, reason: "notes" };
    policies.push({
      label: policyLabel(lang, item?.label, index),
      notes,
    });
  }
  return { ok: true, policies };
}

const TABLE_FIELDS = ["covered", "limits", "deductible", "exclusions", "renewal"];

function cell(value, lang) {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (Array.isArray(value)) {
    const text = value.map(String).join("\n").trim();
    if (text) return text;
  }
  return t(lang, "compareNotFound");
}

function block(value) {
  if (typeof value === "string") return value.trim();
  if (Array.isArray(value)) return value.map(String).join("\n").trim();
  return "";
}

/** Turn the model's JSON into the table the page can render. Labels stay the ones the person typed. */
export function normalizeComparison(parsed, labels, lang = "en") {
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("not an object");
  }
  const summaries = Array.isArray(parsed.policies) ? parsed.policies : [];
  const table = Array.isArray(parsed.table) ? parsed.table : [];
  const policies = labels.map((label, index) => {
    const source = summaries[index];
    const summary = source && typeof source === "object" ? source.summary : source;
    const text = typeof summary === "string" ? summary.trim() : "";
    return { label, summary: text || t(lang, "compareSummaryMissing") };
  });
  const rows = labels.map((label, index) => {
    const source = table[index] && typeof table[index] === "object" ? table[index] : {};
    const row = { label };
    for (const field of TABLE_FIELDS) row[field] = cell(source[field], lang);
    return row;
  });
  return {
    policies,
    rows,
    gaps: block(parsed.gaps) || t(lang, "compareNoneFound"),
    overlaps: block(parsed.overlaps) || t(lang, "compareNoneFound"),
    questions: block(parsed.questions) || t(lang, "compareNoneFound"),
  };
}

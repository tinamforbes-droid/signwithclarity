import { cleanComparisonPolicies, normalizeComparison, policyLabel } from "./comparePolicy.js";
import { DecodeError, groupNotes, joinNotes, notesFromPages, parseModelJson, withRetry } from "./decodeRun.js";
import {
  MAX_NOTES_CHARS,
  MAX_SERVER_NOTES,
  planDocument,
  tooLongMessage,
} from "./limits.js";
import { asLanguage, t } from "./messages.js";
import { MAX_COMPARE_POLICIES, MIN_COMPARE_POLICIES } from "./plans.js";

const defaultSleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function createComparisonId() {
  return globalThis.crypto.randomUUID();
}

function perPolicyCap(count) {
  const room = MAX_SERVER_NOTES - 2000;
  return Math.min(MAX_NOTES_CHARS, Math.max(2000, Math.floor(room / count)));
}

async function compactNotes(notes, cap, where, request, sleep) {
  let pending = notes;
  for (let round = 0; round < 6 && joinNotes(pending).length > cap && pending.length > 1; round++) {
    const groups = groupNotes(pending, cap);
    if (groups.length >= pending.length) break;
    const next = [];
    for (const group of groups) {
      const reduced = await withRetry(
        () => request({
          mode: "reduce",
          ...where,
          notes: group.join("\n\n"),
        }),
        { sleep, language: where.language },
      );
      next.push(reduced);
    }
    pending = next;
  }
  let text = joinNotes(pending);
  if (text.length > cap && text.length <= MAX_SERVER_NOTES) {
    text = await withRetry(
      () => request({ mode: "reduce", ...where, notes: text }),
      { sleep, language: where.language },
    );
  }
  if (text.length > cap) {
    throw new DecodeError(t(where.language, "errorCombine"), { code: "too_long" });
  }
  return text;
}

function comparisonSections(text, labels, language) {
  try {
    return normalizeComparison(parseModelJson(text), labels, language);
  } catch {
    throw new DecodeError(t(language, "errorBadJson"), { retryable: true, code: "bad_json" });
  }
}

/**
 * Read 2 to 4 policies, in parts when they are long, then ask for one comparison.
 * Every model call shares one id, so the whole comparison spends one check
 * or one yearly explanation. Nothing is stored here.
 */
export async function runComparison({
  policies,
  country,
  region,
  language = "en",
  comparisonId,
  onProgress,
  request,
  sleep = defaultSleep,
}) {
  const lang = asLanguage(language) || "en";
  const list = Array.isArray(policies) ? policies : [];
  if (list.length < MIN_COMPARE_POLICIES || list.length > MAX_COMPARE_POLICIES) {
    throw new DecodeError(t(lang, "compareCount"), { code: "count" });
  }

  const prepared = list.map((policy, index) => {
    const pages = Array.isArray(policy?.pages) ? policy.pages.filter(Boolean) : [];
    if (pages.length) {
      return { label: policyLabel(lang, policy?.label, index), pages, plan: { ok: true, chunks: [] } };
    }
    const plan = planDocument(policy?.text);
    return { label: policyLabel(lang, policy?.label, index), pages: [], plan };
  });
  for (const policy of prepared) {
    if (policy.pages.length) continue;
    if (!policy.plan.ok) {
      if (policy.plan.reason === "empty") {
        throw new DecodeError(t(lang, "compareNeedText"), { code: "empty" });
      }
      throw new DecodeError(tooLongMessage(policy.plan, lang), { code: "too_long" });
    }
  }

  const where = {
    country,
    region,
    language: lang,
    purpose: "compare",
    explanationId: comparisonId || createComparisonId(),
    comparisonId: comparisonId || undefined,
  };
  where.comparisonId = where.explanationId;

  const totalChunks = prepared.reduce((sum, policy) => (
    sum + (policy.pages.length || policy.plan.chunks.length)
  ), 0);
  const cap = perPolicyCap(prepared.length);
  let seen = 0;
  const briefs = [];

  for (let index = 0; index < prepared.length; index++) {
    const policy = prepared[index];
    if (policy.pages.length) {
      const photoNotes = await notesFromPages({
        pages: policy.pages,
        where,
        request,
        sleep,
        onProgress,
        seenStart: seen,
        total: totalChunks,
        policy: index + 1,
        policies: prepared.length,
      });
      seen += policy.pages.length;
      onProgress?.({
        phase: "combining",
        policy: index + 1,
        policies: prepared.length,
        current: seen,
        total: totalChunks,
      });
      const brief = policy.pages.length === 1
        ? photoNotes[0]
        : await compactNotes(photoNotes, cap, where, request, sleep);
      briefs.push({ label: policy.label, notes: brief });
      continue;
    }
    const chunks = policy.plan.chunks;
    const notes = [];
    for (let chunk = 0; chunk < chunks.length; chunk++) {
      seen += 1;
      onProgress?.({
        phase: "reading",
        policy: index + 1,
        policies: prepared.length,
        current: seen,
        total: totalChunks,
      });
      const noteText = await withRetry(
        () => request({
          mode: "extract",
          ...where,
          docText: chunks[chunk],
          chunkIndex: chunk + 1,
          chunkCount: chunks.length,
        }),
        { sleep, part: chunk + 1, total: chunks.length, language: lang },
      );
      notes.push(`Part ${chunk + 1} of ${chunks.length}:\n${noteText}`);
    }
    onProgress?.({
      phase: "combining",
      policy: index + 1,
      policies: prepared.length,
      current: seen,
      total: totalChunks,
    });
    const brief = chunks.length === 1
      ? notes[0]
      : await compactNotes(notes, cap, where, request, sleep);
    briefs.push({ label: policy.label, notes: brief });
  }

  const cleaned = cleanComparisonPolicies(briefs, lang);
  if (!cleaned.ok) {
    throw new DecodeError(
      cleaned.reason === "notes" ? t(lang, "errorCombine") : t(lang, "compareNeedText"),
      { code: cleaned.reason === "notes" ? "too_long" : "empty" },
    );
  }

  onProgress?.({
    phase: "comparing",
    policies: prepared.length,
    current: totalChunks,
    total: totalChunks,
  });
  const comparison = await withRetry(
    async () => comparisonSections(await request({
      mode: "compare",
      ...where,
      policies: cleaned.policies,
    }), cleaned.policies.map((policy) => policy.label), lang),
    { sleep, language: lang },
  );
  return { comparison, parts: totalChunks };
}

import { MAX_IMAGE_PAGES, policyHasReading } from "./images.js";
import { planDocument, tooLongMessage } from "./limits.js";
import { t } from "./messages.js";

function fileProblem(lang, policy) {
  if (!policy?.problem) return "";
  const name = String(policy.fileName || "").trim();
  if (policy.problem === "noText" && name) return t(lang, "noTextInFile", { name });
  if (policy.problem === "photo") return t(lang, "photoReadError");
  if (policy.problem === "tooMany") {
    return t(lang, "tooManyPhotos", {
      count: policy.pageCount || MAX_IMAGE_PAGES + 1,
      max: MAX_IMAGE_PAGES,
    });
  }
  if (policy.problem === "pdf") return t(lang, "pdfReadError");
  return "";
}

/**
 * Why the compare button is off. Empty when the comparison can start.
 * A file that produced no text is named, so a green checkmark is not the only clue.
 */
export function compareDisabledReason(lang, { policies = [], allowed = false, blockedNote = "", readingName = "" } = {}) {
  if (readingName) return t(lang, "readingFile", { name: readingName });
  for (const policy of policies) {
    const problem = fileProblem(lang, policy);
    if (problem) return problem;
  }
  for (const policy of policies) {
    if (!String(policy?.text || "").trim() || policy?.pages?.length) continue;
    const plan = planDocument(policy.text);
    if (!plan.ok && plan.reason === "too_long") return tooLongMessage(plan, lang);
  }
  if (!allowed) return blockedNote || t(lang, "compareNeedsPlan");
  if (policies.filter(policyHasReading).length < 2) {
    const named = policies.find((policy) => policy?.fileName && !policyHasReading(policy));
    if (named?.fileName) return t(lang, "noTextInFile", { name: named.fileName });
    return t(lang, "compareNeedTwoReady");
  }
  return "";
}

/** Why Explain is off. Empty when a document can be read. */
export function explainDisabledReason(lang, {
  text = "",
  pages = [],
  fileName = "",
  problem = "",
  pageCount = 0,
  atLimit = false,
  limitMessage = "",
  readingName = "",
} = {}) {
  if (readingName) return t(lang, "readingFile", { name: readingName });
  const fromFile = fileProblem(lang, { problem, fileName, pageCount });
  if (fromFile) return fromFile;
  if (String(text || "").trim()) {
    const plan = planDocument(text);
    if (!plan.ok && plan.reason === "too_long") return tooLongMessage(plan, lang);
  }
  if (atLimit && limitMessage) return limitMessage;
  if (!policyHasReading({ text, pages })) return t(lang, "explainNeedDocument");
  return "";
}

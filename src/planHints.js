import { isYearlyActive, visibleChecks } from "../shared/entitlement.js";
import { t } from "../shared/messages.js";

/** Calm lines for the signed-in bar. Empty when there is nothing paid to mention. */
export function planHintText(lang, account, now = new Date()) {
  if (!account || account.paid !== true) return "";
  const lines = [];
  if (isYearlyActive(account, now)) lines.push(t(lang, "signedInYearly"));
  const checks = visibleChecks(account);
  if (checks === 1) lines.push(t(lang, "signedInChecksOne"));
  else if (checks > 1) lines.push(t(lang, "signedInChecks", { count: checks }));
  const explanations = Math.max(0, account.credits_remaining || 0);
  if (explanations > 0 && !isYearlyActive(account, now)) {
    lines.push(t(lang, explanations === 1 ? "householdRemainingOne" : "signedInHousehold", { count: explanations }));
  }
  return lines.join(" ");
}

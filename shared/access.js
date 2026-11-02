/**
 * Paid plans are capped. They are not unlimited.
 *
 * hasUnlimitedAccess stays false. A field in the request body cannot
 * turn it on. Tests can still pass a replacement through the decode
 * context when they need to skip the counter.
 *
 * A confirmed account is read from public.accounts with the server
 * secret. Household Check spends one of its credits. Clarity Yearly
 * spends one of YEARLY_FAIR_USE_LIMIT explanations in the paid year.
 * Anyone else keeps the free monthly limit.
 */

import { asLanguage, t } from "./messages.js";
import { formatResetDate } from "./usageCopy.js";
import { createSupabaseAccountStore } from "./accountStore.js";
import { decideConsume, decideRelease, isoDate, paidUsage } from "./entitlement.js";

export async function hasUnlimitedAccess() {
  return false;
}

export async function settlePaidUse({
  user,
  env,
  explanationId,
  now = new Date(),
  language = "en",
  accountStore,
  fetchImpl,
} = {}) {
  const lang = asLanguage(language) || "en";
  const userId = String(user?.id || "").trim().toLowerCase();
  if (!userId || !explanationId) return null;

  const store = accountStore || createSupabaseAccountStore(env, fetchImpl || globalThis.fetch);
  if (!store) return null;

  let result;
  try {
    result = await store.update(userId, (account) => {
      const decision = decideConsume(account, explanationId, now);
      if (decision.kind === "fresh" || decision.kind === "repeat") {
        return { write: true, account: decision.account, decision };
      }
      return { write: false, decision };
    });
  } catch (err) {
    console.error("paid access check failed");
    if (err?.code === "account_read" || err?.code === "account_write" || err?.code === "account_busy") {
      return {
        allowed: false,
        statusCode: 503,
        body: { error: t(lang, "errorGeneric"), code: "account_busy" },
        release: null,
      };
    }
    throw err;
  }

  const decision = result?.decision;
  if (!decision || decision.kind === "none") return null;

  const account = decision.account || result.account;
  if (decision.kind === "closed") {
    return {
      allowed: false,
      statusCode: 400,
      body: {
        error: t(lang, "errorExplanationClosed"),
        code: "explanation_closed",
        usage: paidUsage(account, account?.plan === "yearly" ? "yearly" : "household"),
      },
      release: null,
    };
  }
  if (decision.kind === "fair_use") {
    const usage = paidUsage(account, "yearly");
    return {
      allowed: false,
      statusCode: 402,
      body: {
        error: t(lang, "fairUseReached", { date: formatResetDate(usage.resetsOn || isoDate(account?.period_end), lang) }),
        code: "fair_use",
        usage,
      },
      release: null,
    };
  }

  const usage = paidUsage(account, decision.plan);
  return {
    allowed: true,
    usage,
    release: decision.kind === "fresh"
      ? async () => {
        try {
          await store.update(userId, (current) => {
            const released = decideRelease(current, explanationId);
            if (!released.restore) return { write: false };
            return { write: true, account: released.account };
          });
        } catch {
          console.error("paid credit release failed");
        }
      }
      : null,
  };
}

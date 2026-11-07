import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { RenderProblem } from "../src/AppErrorBoundary.js";
import { planHintText } from "../src/planHints.js";
import {
  canCompareAccount,
  isYearlyActive,
  isoDate,
  visibleChecks,
} from "../shared/entitlement.js";
import { formatResetDate, usageStatusMessage } from "../shared/usageCopy.js";

const NOW = new Date("2026-11-02T15:00:00Z");

function yearlyRow(extra = {}) {
  return {
    paid: true,
    plan: "yearly",
    credits_remaining: null,
    checks_remaining: null,
    yearly_used: null,
    period_end: "2027-11-07T00:10:00.000Z",
    stripe_customer_id: null,
    stripe_subscription_id: null,
    ...extra,
  };
}

test("a yearly account with null counts still renders its plan hint", () => {
  const account = yearlyRow();
  assert.equal(isYearlyActive(account), true);
  assert.equal(canCompareAccount(account, NOW), true);
  assert.equal(visibleChecks(account), 0);
  assert.equal(planHintText("en", account, NOW), "Clarity Yearly is active on this account.");
  assert.match(planHintText("fr", account, NOW), /Clarity Yearly est actif/);
  assert.match(planHintText("es", account, NOW), /Clarity Yearly está activo/);

  const date = formatResetDate(isoDate(account.period_end), "en");
  assert.match(date, /2027/);
  assert.equal(usageStatusMessage("en", {
    limited: true,
    plan: "yearly",
    remaining: null,
    resetsOn: null,
  }), "");
  assert.match(usageStatusMessage("en", {
    limited: true,
    plan: "yearly",
    remaining: null,
    resetsOn: isoDate(account.period_end),
  }), /100 explanations/);
  assert.match(usageStatusMessage("fr", {
    limited: true,
    plan: "yearly",
    remaining: 99,
    resetsOn: isoDate(account.period_end),
  }), /99/);
});

test("a yearly row with no period end does not throw", () => {
  const account = yearlyRow({ period_end: null, yearly_used: null });
  assert.equal(isYearlyActive(account, null), false);
  assert.equal(canCompareAccount(account, NOW), false);
  assert.equal(planHintText("en", account, NOW), "");
  assert.equal(isoDate(null), "");
  assert.equal(formatResetDate(null, "fr"), "");
});

test("a render error offers a reload in each language", () => {
  for (const [lang, label] of [
    ["en", "Reload the page"],
    ["fr", "Recharger la page"],
    ["es", "Volver a cargar la página"],
  ]) {
    const html = renderToStaticMarkup(createElement(RenderProblem, { lang, onReload() {} }));
    assert.match(html, /<button/);
    assert.match(html, new RegExp(label));
    assert.equal(html.includes("<script"), false);
  }
});

import { useEffect, useState } from "react";

import { visibleChecks } from "../shared/entitlement.js";
import { currencyForCountry } from "../shared/plans.js";
import { t } from "../shared/messages.js";
import { currentAccessToken } from "./authClient.js";
import { loadOwnPlan } from "./accountRow.js";

function money(amount, currency, lang) {
  const locale = lang === "fr" ? "fr-CA" : lang === "es" ? "es-419" : "en-CA";
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: currency === "usd" ? "USD" : "CAD",
    maximumFractionDigits: 0,
  }).format(amount);
}

async function postBilling(path, body) {
  const token = await currentAccessToken();
  const headers = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  const response = await fetch(path, { method: "POST", headers, body: JSON.stringify(body) });
  let data = {};
  try {
    data = await response.json();
  } catch {
    data = {};
  }
  if (!response.ok || !data.url) {
    const error = new Error(typeof data.error === "string" ? data.error : "");
    error.code = data.code || "";
    throw error;
  }
  return data.url;
}

export default function Pricing({ lang, country }) {
  const [currencyOverride, setCurrencyOverride] = useState("");
  const currency = currencyOverride || currencyForCountry(country);
  const [viewer, setViewer] = useState(null);
  const [notice, setNotice] = useState(() => {
    try {
      const checkout = new URLSearchParams(window.location.search).get("checkout");
      return checkout === "success" || checkout === "cancel" ? checkout : "";
    } catch {
      return "";
    }
  });
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (notice !== "success" && notice !== "cancel") return undefined;
    const params = new URLSearchParams(window.location.search);
    if (!params.has("checkout")) return undefined;
    params.delete("checkout");
    const query = params.toString();
    const next = `${window.location.pathname}${query ? `?${query}` : ""}${window.location.hash || "#pricing"}`;
    window.history.replaceState({}, "", next);
    return undefined;
  }, [notice]);

  useEffect(() => {
    let active = true;
    const refresh = () => {
      loadOwnPlan().then((row) => {
        if (active) setViewer(row);
      }).catch(() => {
        if (active) setViewer(null);
      });
    };
    refresh();
    const onFocus = () => refresh();
    window.addEventListener("swc-account-refresh", refresh);
    window.addEventListener("focus", onFocus);
    return () => {
      active = false;
      window.removeEventListener("swc-account-refresh", refresh);
      window.removeEventListener("focus", onFocus);
    };
  }, []);

  useEffect(() => {
    if (notice !== "success") return undefined;
    let tries = 0;
    const timer = window.setInterval(() => {
      tries += 1;
      window.dispatchEvent(new Event("swc-account-refresh"));
      if (tries >= 4) window.clearInterval(timer);
    }, 2000);
    return () => window.clearInterval(timer);
  }, [notice]);

  const account = viewer?.account;
  const yearly = account?.plan === "yearly" && account?.paid === true;
  const checks = account?.paid ? visibleChecks(account) : 0;
  const householdCredits = account?.paid ? Math.max(0, account.credits_remaining || 0) : 0;
  const signedIn = Boolean(viewer?.signedIn);

  async function buy(plan) {
    setError("");
    setNotice("");
    if (!signedIn) {
      setError(t(lang, "pricingNeedSignIn"));
      document.querySelector(".account-bar")?.scrollIntoView({ behavior: "smooth", block: "center" });
      document.getElementById("sign-in-email")?.focus();
      return;
    }
    setBusy(plan);
    try {
      const url = await postBilling("/.netlify/functions/checkout", { plan, currency, language: lang });
      window.location.assign(url);
    } catch (err) {
      setError(err?.message || t(lang, "pricingFailed"));
      setBusy("");
    }
  }

  async function manage() {
    setError("");
    setBusy("portal");
    try {
      const url = await postBilling("/.netlify/functions/portal", { language: lang });
      window.location.assign(url);
    } catch (err) {
      setError(err?.message || t(lang, "pricingManageFailed"));
      setBusy("");
    }
  }

  const code = currency === "usd" ? "USD" : "CAD";

  return (
    <section className="pricing" id="pricing" aria-labelledby="pricing-title">
      <h2 className="pricing-title" id="pricing-title">{t(lang, "pricingTitle")}</h2>
      <p className="pricing-lead">{t(lang, "pricingLead")}</p>
      <div className="currency-switch">
        <div role="group" aria-label={t(lang, "pricingCurrency")}>
          {["cad", "usd"].map((choice) => (
            <button
              key={choice}
              type="button"
              aria-pressed={currency === choice}
              onClick={() => {
                setCurrencyOverride(choice);
              }}
            >
              {choice.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {notice === "success" && <p className="pricing-note" role="status">{t(lang, "pricingCheckoutSuccess")}</p>}
      {notice === "cancel" && <p className="pricing-note" role="status">{t(lang, "pricingCheckoutCancel")}</p>}
      {error && <p className="pricing-error" role="alert">{error}</p>}

      <div className="pricing-grid">
        <article className="plan-card">
          <h3 className="plan-name">{t(lang, "pricingFreeName")}</h3>
          <p className="plan-price">{money(0, currency, lang)}</p>
          <p className="plan-detail">{t(lang, "pricingFreeDetail")}</p>
          {!yearly && !(householdCredits > 0) && !(checks > 0) && signedIn && (
            <p className="plan-current">{t(lang, "pricingCurrent")}</p>
          )}
        </article>

        <article className="plan-card">
          <h3 className="plan-name">{t(lang, "pricingHouseholdName")}</h3>
          <p className="plan-price">{money(9, currency, lang)}</p>
          <p className="plan-detail">{t(lang, "pricingHouseholdDetail")}</p>
          {checks > 0 && (
            <p className="plan-current">{t(lang, checks === 1 ? "householdCheckRemainingOne" : "householdCheckRemaining", { count: checks })}</p>
          )}
          {householdCredits > 0 && (
            <p className="plan-current">{t(lang, householdCredits === 1 ? "householdRemainingOne" : "householdRemaining", { count: householdCredits })}</p>
          )}
          <button className="plan-btn" type="button" disabled={Boolean(busy)} onClick={() => buy("household")}>
            {busy === "household" ? t(lang, "pricingWorking") : (signedIn ? t(lang, "pricingBuy") : t(lang, "pricingSignInToBuy"))}
          </button>
        </article>

        <article className="plan-card">
          <h3 className="plan-name">{t(lang, "pricingYearlyName")}</h3>
          <p className="plan-price">
            {money(39, currency, lang)}
            <span className="plan-interval"> {t(lang, "pricingYearlyInterval")}</span>
          </p>
          <p className="plan-detail">{t(lang, "pricingYearlyDetail")}</p>
          {yearly && <p className="plan-current">{t(lang, "pricingCurrent")}</p>}
          {yearly ? (
            <button className="plan-btn" type="button" disabled={Boolean(busy)} onClick={manage}>
              {busy === "portal" ? t(lang, "pricingWorking") : t(lang, "pricingManage")}
            </button>
          ) : (
            <button className="plan-btn" type="button" disabled={Boolean(busy)} onClick={() => buy("yearly")}>
              {busy === "yearly" ? t(lang, "pricingWorking") : (signedIn ? t(lang, "pricingSubscribe") : t(lang, "pricingSignInToBuy"))}
            </button>
          )}
        </article>
      </div>
      <p className="pricing-tax">{t(lang, "pricingTax", { currency: code })}</p>
    </section>
  );
}

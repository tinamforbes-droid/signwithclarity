/**
 * Paid plans for Sign With Clarity.
 *
 * Stripe products, already created:
 *   Household Check — prod_VYa35DVVX8zzUK — one-time, $9 CAD and US$9
 *   Clarity Yearly  — prod_VYaEVm0qbwlG00 — yearly, $39 CAD and US$39
 *
 * Price ids are looked up from those products when checkout opens.
 * Optional environment overrides, when a lookup would pick the wrong price:
 *   STRIPE_PRICE_HOUSEHOLD_CAD, STRIPE_PRICE_HOUSEHOLD_USD
 *   STRIPE_PRICE_YEARLY_CAD, STRIPE_PRICE_YEARLY_USD
 * Each value is a Stripe price id (price_...).
 */

export const HOUSEHOLD_PRODUCT_ID = "prod_VYa35DVVX8zzUK";
export const YEARLY_PRODUCT_ID = "prod_VYaEVm0qbwlG00";

/** Explanations included in one Household Check purchase. */
export const HOUSEHOLD_EXPLANATION_CREDITS = 4;

/**
 * Explanations included in one Clarity Yearly period.
 * The counter resets when the paid year renews.
 */
export const YEARLY_FAIR_USE_LIMIT = 100;

const PRODUCTION_ORIGIN = "https://signwithclarity.ca";

export function productIdForPlan(plan) {
  if (plan === "household") return HOUSEHOLD_PRODUCT_ID;
  if (plan === "yearly") return YEARLY_PRODUCT_ID;
  return "";
}

export function priceEnvName(plan, currency) {
  const which = plan === "yearly" ? "YEARLY" : "HOUSEHOLD";
  return `STRIPE_PRICE_${which}_${String(currency || "").toUpperCase()}`;
}

export function currencyForCountry(country) {
  return country === "United States" ? "usd" : "cad";
}

export function isCurrency(value) {
  return value === "cad" || value === "usd";
}

export function isPlan(value) {
  return value === "household" || value === "yearly";
}

/**
 * Pick the active price for this plan and currency.
 * A price can be in that currency itself, or list it under currency_options.
 */
export function selectPrice(prices, { plan, currency, product }) {
  const list = Array.isArray(prices) ? prices : [];
  const yearly = plan === "yearly";
  for (const price of list) {
    if (!price || price.active === false) continue;
    if (product && price.product && price.product !== product) continue;
    const recurring = price.recurring || null;
    if (yearly) {
      if (!recurring || recurring.interval !== "year") continue;
    } else if (recurring) {
      continue;
    }
    const id = String(price.id || "");
    if (!id) continue;
    if (price.currency === currency) return { id, presentment: "" };
    if (price.currency_options && price.currency_options[currency]) return { id, presentment: currency };
  }
  return null;
}

/**
 * Where Stripe may send the person back. Local http is only this machine.
 * https is this site, or a Netlify deploy preview. Anything else uses the
 * public site, so a request cannot aim the return at another domain.
 */
export function checkoutReturnOrigin(origin) {
  let url;
  try {
    url = new URL(String(origin || ""));
  } catch {
    return PRODUCTION_ORIGIN;
  }
  const local = url.hostname === "localhost" || url.hostname === "127.0.0.1";
  if (url.protocol === "http:" && local) return url.origin;
  if (url.protocol !== "https:") return PRODUCTION_ORIGIN;
  const host = url.hostname;
  if (host === "signwithclarity.ca" || host === "www.signwithclarity.ca") return url.origin;
  if (host.endsWith(".netlify.app")) return url.origin;
  return PRODUCTION_ORIGIN;
}

export function requestOrigin(headers) {
  if (!headers) return "";
  const wanted = ["origin", "referer"];
  const entries = Object.entries(headers);
  for (const name of wanted) {
    for (const [key, value] of entries) {
      if (String(key).toLowerCase() !== name) continue;
      const raw = Array.isArray(value) ? value[0] : value;
      return String(raw || "");
    }
  }
  return "";
}

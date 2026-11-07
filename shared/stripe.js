import { createHmac, timingSafeEqual } from "node:crypto";

import {
  priceEnvName,
  productIdForPlan,
  selectPrice,
} from "./plans.js";

/** Managed Payments needs this API version or newer. */
export const STRIPE_VERSION = "2026-04-22.dahlia";

const STRIPE_API = "https://api.stripe.com/v1";
const PRICE_TTL_MS = 10 * 60 * 1000;
const priceCache = new Map();

export function formEncode(value) {
  const pairs = [];
  function walk(prefix, current) {
    if (current == null) return;
    if (typeof current === "boolean") {
      pairs.push([prefix, current ? "true" : "false"]);
      return;
    }
    if (Array.isArray(current)) {
      current.forEach((item, index) => walk(`${prefix}[${index}]`, item));
      return;
    }
    if (typeof current === "object") {
      for (const [key, item] of Object.entries(current)) {
        walk(prefix ? `${prefix}[${key}]` : key, item);
      }
      return;
    }
    pairs.push([prefix, String(current)]);
  }
  walk("", value);
  return pairs
    .map(([key, item]) => `${encodeURIComponent(key)}=${encodeURIComponent(item)}`)
    .join("&");
}

export function verifyStripeSignature(rawBody, header, secret, nowMs = Date.now(), toleranceSec = 300) {
  const key = String(secret || "");
  const payload = String(rawBody ?? "");
  const signature = String(header || "");
  if (!key || !payload || !signature) return null;

  let timestamp = "";
  const signatures = [];
  for (const part of signature.split(",")) {
    const trimmed = part.trim();
    if (trimmed.startsWith("t=")) timestamp = trimmed.slice(2);
    if (trimmed.startsWith("v1=")) signatures.push(trimmed.slice(3));
  }
  if (!/^\d+$/.test(timestamp) || signatures.length === 0) return null;
  const age = Math.abs(nowMs / 1000 - Number(timestamp));
  if (age > toleranceSec) return null;

  const expected = createHmac("sha256", key).update(`${timestamp}.${payload}`).digest("hex");
  const expectedBuf = Buffer.from(expected);
  const matches = signatures.some((candidate) => {
    const buf = Buffer.from(String(candidate));
    if (buf.length !== expectedBuf.length) return false;
    return timingSafeEqual(buf, expectedBuf);
  });
  if (!matches) return null;
  try {
    return JSON.parse(payload);
  } catch {
    return null;
  }
}

export function rawEventBody(event) {
  if (!event || event.body == null) return "";
  if (event.isBase64Encoded) return Buffer.from(String(event.body), "base64").toString("utf8");
  return typeof event.body === "string" ? event.body : "";
}

export function stripeSignatureHeader(headers) {
  if (!headers) return "";
  for (const [key, value] of Object.entries(headers)) {
    if (String(key).toLowerCase() !== "stripe-signature") continue;
    return Array.isArray(value) ? String(value[0] || "") : String(value || "");
  }
  return "";
}

export async function stripeRequest({ env, path, method = "GET", params, fetchImpl = fetch } = {}) {
  const key = String(env?.STRIPE_SECRET_KEY || "").trim();
  if (!key) {
    const error = new Error("stripe is not configured");
    error.code = "stripe_not_configured";
    throw error;
  }
  const response = await fetchImpl(`${STRIPE_API}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${key}`,
      "Stripe-Version": STRIPE_VERSION,
      ...(params ? { "Content-Type": "application/x-www-form-urlencoded" } : {}),
    },
    body: params ? formEncode(params) : undefined,
  });
  const text = typeof response.text === "function" ? await response.text() : "";
  let data = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = {};
  }
  if (!response.ok) {
    const message = stripeErrorText(data);
    console.error(`swc stripe status=${response.status} msg=${message || "none"}`);
    const error = new Error("stripe request failed");
    error.code = "stripe_http";
    error.status = response.status;
    throw error;
  }
  return data;
}

/** Stripe's own error sentence, with key-shaped tokens removed. */
function stripeErrorText(data) {
  const message = data?.error?.message;
  if (typeof message !== "string") return "";
  return message
    .replace(/\b(?:sk|rk|pk)_(?:live|test)_[A-Za-z0-9_]+/g, "[secret]")
    .replace(/\bwhsec_[A-Za-z0-9_]+/g, "[secret]")
    .replace(/[^\x20-\x7E]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 240);
}

export async function resolvePriceId({ env, plan, currency, fetchImpl, now = Date.now() } = {}) {
  const override = String(env?.[priceEnvName(plan, currency)] || "").trim();
  if (override.startsWith("price_")) return { id: override, presentment: "" };

  const cacheKey = `${plan}:${currency}`;
  const hit = priceCache.get(cacheKey);
  if (hit && now - hit.at < PRICE_TTL_MS) return { id: hit.id, presentment: hit.presentment };

  const product = productIdForPlan(plan);
  const data = await stripeRequest({
    env,
    path: `/prices?product=${encodeURIComponent(product)}&active=true&limit=100`,
    fetchImpl,
  });
  const selected = selectPrice(data?.data, { plan, currency, product });
  if (selected?.id) priceCache.set(cacheKey, { ...selected, at: now });
  return selected;
}

export function clearPriceCache() {
  priceCache.clear();
}

export function checkoutSessionParams({ priceId, plan, currency, userId, email, customerId, origin, locale }) {
  const params = {
    mode: plan === "yearly" ? "subscription" : "payment",
    line_items: [{ price: priceId, quantity: 1 }],
    managed_payments: { enabled: true },
    // Managed Payments rejects custom_text on both plans.
    client_reference_id: userId,
    metadata: { user_id: userId, plan },
    success_url: `${origin}/?checkout=success`,
    cancel_url: `${origin}/?checkout=cancel`,
    locale: locale || "en",
  };
  if (currency) params.currency = currency;
  if (customerId) {
    params.customer = customerId;
  } else if (email) {
    params.customer_email = email;
  }
  if (plan === "yearly") {
    params.subscription_data = { metadata: { user_id: userId, plan: "yearly" } };
  }
  return params;
}

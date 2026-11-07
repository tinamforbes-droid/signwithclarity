/**
 * Live and sandbox Stripe data must not be mixed.
 * A restricted key rk_live_ or a secret key sk_live_ is the live site.
 * Older rows have no stripe_livemode. Those rows were written in sandbox.
 */

export function stripeKeyIsLive(key) {
  const value = String(key || "").trim();
  return value.startsWith("sk_live_") || value.startsWith("rk_live_");
}

/** The public site uses live Stripe. Deploy previews and local copies use sandbox. */
export function pageUsesLiveStripe(hostname) {
  const host = String(hostname || "").trim().toLowerCase().replace(/\.$/, "");
  return host === "signwithclarity.ca" || host === "www.signwithclarity.ca";
}

/** "live", "test", or null when this row was not written by Stripe. */
export function accountStripeMode(account) {
  if (!account || typeof account !== "object") return null;
  if (account.stripe_livemode === true) return "live";
  if (account.stripe_livemode === false) return "test";
  if (account.stripe_customer_id || account.stripe_subscription_id || account.plan === "yearly") {
    return "test";
  }
  return null;
}

/**
 * A view of the row for the Stripe mode that is running now.
 * The stored row is not changed. Sandbox plans stay in the database
 * for a sandbox site, and a live site does not treat them as paid.
 */
export function projectAccountForStripeMode(account, live) {
  if (!account) return account;
  const mode = accountStripeMode(account);
  if (mode == null || (mode === "live") === Boolean(live)) return account;
  return {
    ...account,
    paid: false,
    plan: null,
    credits_remaining: 0,
    checks_remaining: 0,
    yearly_used: 0,
    period_end: null,
    stripe_customer_id: null,
    stripe_subscription_id: null,
  };
}

/** Replace a customer id, and drop a plan that belongs to the other Stripe mode. */
export function accountWithStripeCustomer(account, customerId, live) {
  const current = account && typeof account === "object" ? account : {};
  const mode = accountStripeMode(current);
  const want = live ? "live" : "test";
  const mismatch = mode != null && mode !== want;
  const base = mismatch ? projectAccountForStripeMode(current, live) : { ...current };
  return {
    ...base,
    stripe_customer_id: customerId,
    stripe_livemode: Boolean(live),
  };
}

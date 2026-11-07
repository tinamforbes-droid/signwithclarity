import { pageUsesLiveStripe, projectAccountForStripeMode } from "../shared/stripeMode.js";
import { getAuthClient } from "./authClient.js";

/** The signed-in person's own plan row. The browser can read it. It cannot change it. */
export async function loadOwnPlan() {
  const client = getAuthClient();
  if (!client) return { configured: false, signedIn: false, account: null };
  let session;
  try {
    const { data, error } = await client.auth.getSession();
    if (error) return { configured: true, signedIn: false, account: null };
    session = data?.session || null;
  } catch {
    return { configured: true, signedIn: false, account: null };
  }
  const user = session?.user;
  if (!user?.id) return { configured: true, signedIn: false, account: null };
  try {
    const withMode = "paid, plan, credits_remaining, checks_remaining, yearly_used, period_end, stripe_customer_id, stripe_subscription_id, stripe_livemode";
    const withoutMode = "paid, plan, credits_remaining, checks_remaining, yearly_used, period_end, stripe_customer_id, stripe_subscription_id";
    let { data, error } = await client.from("accounts").select(withMode).eq("user_id", user.id).maybeSingle();
    if (error) {
      const again = await client.from("accounts").select(withoutMode).eq("user_id", user.id).maybeSingle();
      data = again.data;
      error = again.error;
    }
    if (error) {
      const fallback = await client
        .from("accounts")
        .select("paid, plan, credits_remaining, yearly_used, period_end")
        .eq("user_id", user.id)
        .maybeSingle();
      data = fallback.data;
      error = fallback.error;
    }
    const live = pageUsesLiveStripe(globalThis.location?.hostname);
    return {
      configured: true,
      signedIn: true,
      email: typeof user.email === "string" ? user.email : "",
      account: error ? null : projectAccountForStripeMode(data, live),
    };
  } catch {
    return {
      configured: true,
      signedIn: true,
      email: typeof user.email === "string" ? user.email : "",
      account: null,
    };
  }
}

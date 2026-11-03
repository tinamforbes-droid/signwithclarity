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
    let { data, error } = await client
      .from("accounts")
      .select("paid, plan, credits_remaining, checks_remaining, yearly_used, period_end")
      .eq("user_id", user.id)
      .maybeSingle();
    if (error) {
      const fallback = await client
        .from("accounts")
        .select("paid, plan, credits_remaining, yearly_used, period_end")
        .eq("user_id", user.id)
        .maybeSingle();
      data = fallback.data;
      error = fallback.error;
    }
    return {
      configured: true,
      signedIn: true,
      email: typeof user.email === "string" ? user.email : "",
      account: error ? null : data,
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

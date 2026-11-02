/**
 * Paid or signed-in people will skip the free monthly limit.
 *
 * This step always returns false. A later step can return true from here
 * after the server has checked a Supabase session or a Lemon Squeezy
 * subscription. Do not trust a field in the request body: the browser
 * must not be able to turn this on by itself.
 */
export async function hasUnlimitedAccess() {
  return false;
}

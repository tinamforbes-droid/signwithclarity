/**
 * Paid accounts will skip the free monthly limit.
 *
 * Signing in does not. A signed-in person still has three free
 * explanations a month. Those are counted on the account in
 * shared/usageGate.js, after the server has checked the Supabase session.
 * This function stays false until a later step reads public.accounts.paid
 * for that account with the secret key. The paid flag stays false today.
 * A field in the request body cannot turn this on.
 */
export async function hasUnlimitedAccess() {
  return false;
}

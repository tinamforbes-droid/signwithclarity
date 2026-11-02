import { createClient } from "@supabase/supabase-js";

import { isAccessToken, isBrowserPublishableKey, supabaseProjectUrl } from "../shared/session.js";

const projectUrl = supabaseProjectUrl({
  VITE_SUPABASE_URL: import.meta.env.VITE_SUPABASE_URL,
});
const publishableKey = String(import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || "").trim();

let client;

export function authConfigured() {
  return Boolean(projectUrl && isBrowserPublishableKey(publishableKey));
}

export function getAuthClient() {
  if (!authConfigured()) return null;
  if (!client) {
    client = createClient(projectUrl, publishableKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        flowType: "pkce",
        storageKey: "swc-auth",
      },
    });
  }
  return client;
}

/** The current session token, or "" when the person is not signed in. */
export async function currentAccessToken() {
  const auth = getAuthClient();
  if (!auth) return "";
  try {
    const { data, error } = await auth.auth.getSession();
    if (error) return "";
    const token = data?.session?.access_token || "";
    return isAccessToken(token) ? token : "";
  } catch {
    return "";
  }
}

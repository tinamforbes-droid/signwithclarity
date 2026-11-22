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

/**
 * Local preview only. The production build drops this. It lets a screenshot
 * show a signed-in General explanation without an email link. The real
 * server does not accept this token.
 */
const DEV_PREVIEW_TOKEN = "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJwcmV2aWV3In0.previewsig";

export function devPreviewSignedIn() {
  if (!import.meta.env.DEV) return false;
  try {
    return new URLSearchParams(window.location.search).get("previewSignedIn") === "1";
  } catch {
    return false;
  }
}

/** The current session token, or "" when the person is not signed in. */
export async function currentAccessToken() {
  if (import.meta.env.DEV && devPreviewSignedIn()) return DEV_PREVIEW_TOKEN;
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

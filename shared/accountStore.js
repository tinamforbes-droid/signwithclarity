import { isUserId, supabaseProjectUrl } from "./session.js";
import { blankAccount, visibleChecks } from "./entitlement.js";

const COLUMNS = [
  "user_id",
  "email",
  "paid",
  "plan",
  "credits_remaining",
  "checks_remaining",
  "yearly_used",
  "period_end",
  "stripe_customer_id",
  "stripe_subscription_id",
  "explanation_claims",
  "subscription_synced_at",
  "updated_at",
].join(",");

const PATCH_FIELDS = [
  "paid",
  "plan",
  "credits_remaining",
  "checks_remaining",
  "yearly_used",
  "period_end",
  "stripe_customer_id",
  "stripe_subscription_id",
  "explanation_claims",
  "subscription_synced_at",
];

function clone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function normalizeRow(row) {
  if (!row || typeof row !== "object") return null;
  const claims = row.explanation_claims && typeof row.explanation_claims === "object"
    ? row.explanation_claims
    : {};
  return {
    user_id: String(row.user_id || "").toLowerCase(),
    email: row.email || null,
    paid: row.paid === true,
    plan: row.plan === "household" || row.plan === "yearly" ? row.plan : null,
    credits_remaining: Number.isInteger(row.credits_remaining) ? row.credits_remaining : 0,
    checks_remaining: Number.isInteger(row.checks_remaining) ? row.checks_remaining : null,
    yearly_used: Number.isInteger(row.yearly_used) ? row.yearly_used : 0,
    period_end: row.period_end || null,
    stripe_customer_id: row.stripe_customer_id || null,
    stripe_subscription_id: row.stripe_subscription_id || null,
    explanation_claims: claims,
    subscription_synced_at: row.subscription_synced_at || null,
    updated_at: row.updated_at || null,
  };
}

function patchBody(account) {
  const body = {};
  for (const field of PATCH_FIELDS) body[field] = account[field] ?? null;
  body.explanation_claims = account.explanation_claims || {};
  body.credits_remaining = account.credits_remaining || 0;
  body.checks_remaining = Number.isInteger(account.checks_remaining)
    ? account.checks_remaining
    : visibleChecks(account);
  body.yearly_used = account.yearly_used || 0;
  body.paid = account.paid === true;
  return body;
}

export function createMemoryAccountStore(initial = {}) {
  const accounts = new Map();
  for (const [userId, row] of Object.entries(initial)) {
    accounts.set(userId, normalizeRow({ ...blankAccount(userId), ...row, user_id: userId }));
  }
  const events = new Set();
  let tail = Promise.resolve();

  function exclusive(fn) {
    const run = tail.then(fn, fn);
    tail = run.then(() => {}, () => {});
    return run;
  }

  function find(predicate) {
    for (const row of accounts.values()) {
      if (predicate(row)) return clone(row);
    }
    return null;
  }

  return {
    async get(userId) {
      const row = accounts.get(String(userId || "").toLowerCase());
      return row ? clone(row) : null;
    },
    async findBySubscription(subscriptionId) {
      if (!subscriptionId) return null;
      return find((row) => row.stripe_subscription_id === subscriptionId);
    },
    async findByCustomer(customerId) {
      if (!customerId) return null;
      return find((row) => row.stripe_customer_id === customerId);
    },
    async claimEvent(eventId) {
      return exclusive(async () => {
        if (!eventId || events.has(eventId)) return false;
        events.add(eventId);
        return true;
      });
    },
    async releaseEvent(eventId) {
      return exclusive(async () => {
        events.delete(eventId);
      });
    },
    async update(userId, updater) {
      const id = String(userId || "").toLowerCase();
      return exclusive(async () => {
        const current = accounts.get(id) || null;
        const result = updater(current ? clone(current) : null);
        if (!result?.write) {
          return { written: false, account: current ? clone(current) : null, decision: result?.decision };
        }
        const next = normalizeRow({ ...result.account, user_id: id, updated_at: new Date().toISOString() });
        accounts.set(id, next);
        return { written: true, account: clone(next), decision: result.decision };
      });
    },
    snapshot() {
      const out = {};
      for (const [userId, row] of accounts) out[userId] = clone(row);
      return out;
    },
  };
}

function secretKey(env) {
  const secret = String(env?.SUPABASE_SECRET_KEY || "").trim();
  return secret.startsWith("sb_secret_") ? secret : "";
}

async function readJson(response) {
  const text = typeof response?.text === "function" ? await response.text() : "";
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export function createSupabaseAccountStore(env, fetchImpl = fetch) {
  const origin = supabaseProjectUrl(env);
  const secret = secretKey(env);
  if (!origin || !secret) return null;

  const headers = {
    apikey: secret,
    Authorization: `Bearer ${secret}`,
  };

  async function request(path, options = {}) {
    const response = await fetchImpl(`${origin}${path}`, {
      ...options,
      headers: { ...headers, ...(options.headers || {}) },
    });
    return response;
  }

  async function getOne(filter) {
    const response = await request(`/rest/v1/accounts?${filter}&select=${COLUMNS}`);
    if (!response.ok) {
      const error = new Error("account read failed");
      error.code = "account_read";
      throw error;
    }
    const data = await readJson(response);
    if (!Array.isArray(data) || !data[0]) return null;
    return normalizeRow(data[0]);
  }

  return {
    async get(userId) {
      const id = String(userId || "").toLowerCase();
      if (!isUserId(id)) return null;
      return getOne(`user_id=eq.${encodeURIComponent(id)}`);
    },
    async findBySubscription(subscriptionId) {
      if (!subscriptionId) return null;
      return getOne(`stripe_subscription_id=eq.${encodeURIComponent(subscriptionId)}`);
    },
    async findByCustomer(customerId) {
      if (!customerId) return null;
      return getOne(`stripe_customer_id=eq.${encodeURIComponent(customerId)}`);
    },
    async claimEvent(eventId, eventType) {
      const response = await request("/rest/v1/billing_events", {
        method: "POST",
        headers: { "Content-Type": "application/json", Prefer: "return=minimal" },
        body: JSON.stringify({ event_id: eventId, event_type: eventType || "unknown" }),
      });
      if (response.status === 409) return false;
      if (!response.ok) {
        const error = new Error("billing event was not recorded");
        error.code = "event_write";
        throw error;
      }
      return true;
    },
    async releaseEvent(eventId) {
      if (!eventId) return;
      await request(`/rest/v1/billing_events?event_id=eq.${encodeURIComponent(eventId)}`, {
        method: "DELETE",
      });
    },
    async update(userId, updater) {
      const id = String(userId || "").toLowerCase();
      if (!isUserId(id)) {
        return { written: false, account: null, decision: { kind: "none" } };
      }
      for (let attempt = 0; attempt < 6; attempt++) {
        const current = await getOne(`user_id=eq.${encodeURIComponent(id)}`);
        const result = updater(current);
        if (!result?.write) {
          return { written: false, account: current, decision: result?.decision };
        }
        const body = patchBody({ ...result.account, user_id: id });
        if (!current) {
          const inserted = await request("/rest/v1/accounts", {
            method: "POST",
            headers: { "Content-Type": "application/json", Prefer: "return=representation" },
            body: JSON.stringify({ user_id: id, email: result.account.email || null, ...body }),
          });
          if (inserted.status === 409) continue;
          if (!inserted.ok) {
            const error = new Error("account insert failed");
            error.code = "account_write";
            throw error;
          }
          const rows = await readJson(inserted);
          const saved = Array.isArray(rows) ? normalizeRow(rows[0]) : null;
          if (saved) return { written: true, account: saved, decision: result.decision };
          continue;
        }
        const match = current.updated_at
          ? `&updated_at=eq.${encodeURIComponent(current.updated_at)}`
          : "";
        const patched = await request(`/rest/v1/accounts?user_id=eq.${encodeURIComponent(id)}${match}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json", Prefer: "return=representation" },
          body: JSON.stringify(body),
        });
        if (!patched.ok) {
          const error = new Error("account update failed");
          error.code = "account_write";
          throw error;
        }
        const rows = await readJson(patched);
        if (Array.isArray(rows) && rows[0]) {
          return { written: true, account: normalizeRow(rows[0]), decision: result.decision };
        }
      }
      const error = new Error("account busy");
      error.code = "account_busy";
      throw error;
    },
  };
}

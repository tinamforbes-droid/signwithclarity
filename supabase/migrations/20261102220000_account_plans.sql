-- Plan, remaining credits, and the yearly period.
-- The browser still cannot change these. Row level security stays on,
-- and there is still no insert, update, or delete policy for signed-in users.
-- The document, the notes, the card number, and the explanation are not stored.
--
-- Run this once in the Supabase SQL editor, after the accounts table exists.
-- It is safe to run again.

alter table public.accounts
  add column if not exists plan text,
  add column if not exists credits_remaining integer not null default 0,
  add column if not exists yearly_used integer not null default 0,
  add column if not exists period_end timestamptz,
  add column if not exists stripe_customer_id text,
  add column if not exists stripe_subscription_id text,
  add column if not exists explanation_claims jsonb not null default '{}'::jsonb,
  add column if not exists subscription_synced_at timestamptz;

alter table public.accounts drop constraint if exists accounts_plan_check;
alter table public.accounts
  add constraint accounts_plan_check
  check (plan is null or plan in ('household', 'yearly'));

comment on column public.accounts.paid is
  'True only after the server applies a verified Stripe notice. The browser cannot change it.';

comment on column public.accounts.plan is
  'household, yearly, or null. The browser cannot change it.';

comment on column public.accounts.credits_remaining is
  'Household Check explanations still unused. The browser cannot change it.';

comment on column public.accounts.yearly_used is
  'Explanations used in the current Clarity Yearly period. The browser cannot change it.';

comment on column public.accounts.period_end is
  'When the current Clarity Yearly period ends. The browser cannot change it.';

comment on column public.accounts.stripe_customer_id is
  'Stripe customer id for the portal. Not a card number. The browser cannot change it.';

comment on column public.accounts.stripe_subscription_id is
  'Stripe subscription id for Clarity Yearly. The browser cannot change it.';

comment on column public.accounts.explanation_claims is
  'Random explanation ids already counted on a paid plan, and how many calls each used. Not the document.';

comment on column public.accounts.subscription_synced_at is
  'When the latest Stripe subscription notice was applied. An older notice is ignored.';

create index if not exists accounts_stripe_subscription_id_idx
  on public.accounts (stripe_subscription_id)
  where stripe_subscription_id is not null;

create index if not exists accounts_stripe_customer_id_idx
  on public.accounts (stripe_customer_id)
  where stripe_customer_id is not null;

-- Stripe event ids already applied, so a repeated notice does not add credits twice.
-- Signed-in users cannot read or write this table.
create table if not exists public.billing_events (
  event_id text primary key,
  event_type text not null,
  received_at timestamptz not null default now()
);

comment on table public.billing_events is
  'Stripe event ids already applied. No document and no card number are stored here.';

alter table public.billing_events enable row level security;

revoke all on table public.billing_events from public, anon, authenticated;
grant all on table public.billing_events to service_role;

revoke insert, update, delete on table public.accounts from public, anon, authenticated;

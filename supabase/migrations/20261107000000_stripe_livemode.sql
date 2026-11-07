-- Which Stripe mode this account's customer and plan belong to.
-- True is live. False is sandbox. Null is an older row from sandbox tests.
-- The browser can read it. The browser still cannot change it.
-- The document, the notes, the card number, and the explanation are not stored.
--
-- Run this once in the Supabase SQL editor. It is safe to run again.
-- Existing rows are left as they are. A null value means sandbox.

alter table public.accounts
  add column if not exists stripe_livemode boolean;

comment on column public.accounts.stripe_livemode is
  'True when this Stripe customer belongs to live mode. False is sandbox. Null is an older sandbox row. The browser cannot change it.';

revoke insert, update, delete on table public.accounts from public, anon, authenticated;

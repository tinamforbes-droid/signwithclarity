-- Household Check is one comparison of up to 4 policies.
-- credits_remaining still counts single explanations from earlier purchases.
-- checks_remaining counts comparisons. One new purchase adds one.
-- The browser still cannot change these. Row level security stays on.
-- A document, a comparison, and a card number are not stored here.
--
-- Run this in the Supabase SQL editor after the accounts table exists.
-- It is safe to run again. A balance is converted only while
-- checks_remaining is still empty.
--
-- An older balance counted single explanations, four for each purchase.
-- Each four, rounded up, becomes one Household Check. The explanations
-- are kept, so a test account can still explain one document at a time.
--   1, 2, 3, or 4 explanations left  ->  1 Household Check
--   5, 6, 7, or 8                     ->  2 Household Checks
--   none left                         ->  0

alter table public.accounts
  add column if not exists checks_remaining integer;

comment on column public.accounts.checks_remaining is
  'Household Checks still unused. One check compares up to 4 policies. The browser cannot change it.';

comment on column public.accounts.credits_remaining is
  'Single explanations still unused from an earlier Household Check. The browser cannot change it.';

update public.accounts
set checks_remaining = case
  when coalesce(credits_remaining, 0) > 0 then (credits_remaining + 3) / 4
  else 0
end
where checks_remaining is null;

alter table public.accounts drop constraint if exists accounts_checks_remaining_check;
alter table public.accounts
  add constraint accounts_checks_remaining_check
  check (checks_remaining is null or checks_remaining >= 0);

revoke insert, update, delete on table public.accounts from public, anon, authenticated;

-- A place to remember whether an account has paid.
-- Paid stays false. This file does not turn on payments.
-- The document, the notes, and the explanation are not stored here.
--
-- Run this once in the Supabase SQL editor. The pull request explains
-- the clicks. It is safe to run again: existing rows are left as they are.

create table if not exists public.accounts (
  user_id uuid primary key references auth.users (id) on delete cascade,
  email text,
  paid boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.accounts is
  'Whether this account has paid. Documents are never stored here.';

comment on column public.accounts.paid is
  'False until a later payment step sets it. The browser cannot change it.';

alter table public.accounts enable row level security;

-- A signed-in person may read their own row. There is no policy for
-- insert, update, or delete, so the browser cannot change paid.
drop policy if exists accounts_select_own on public.accounts;
create policy accounts_select_own
  on public.accounts
  for select
  to authenticated
  using (auth.uid() = user_id);

revoke all on table public.accounts from public, anon, authenticated;
grant select on table public.accounts to authenticated;
grant all on table public.accounts to service_role;

create or replace function public.accounts_touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = pg_catalog.now();
  return new;
end;
$$;

drop trigger if exists accounts_touch_updated_at on public.accounts;
create trigger accounts_touch_updated_at
  before update on public.accounts
  for each row
  execute function public.accounts_touch_updated_at();

-- New sign-ins get a row with paid = false. The function does not
-- write a document.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.accounts (user_id, email, paid)
  values (new.id, new.email, false)
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();

-- Keep the email on the row if Supabase later changes it. paid is untouched.
create or replace function public.sync_account_email()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.accounts
  set email = new.email
  where user_id = new.id
    and email is distinct from new.email;
  return new;
end;
$$;

drop trigger if exists on_auth_user_email_updated on auth.users;
create trigger on_auth_user_email_updated
  after update of email on auth.users
  for each row
  execute function public.sync_account_email();

revoke all on function public.handle_new_user() from public, anon, authenticated;
revoke all on function public.sync_account_email() from public, anon, authenticated;
revoke all on function public.accounts_touch_updated_at() from public, anon, authenticated;

-- Accounts that already exist, from a sign-in before this file was run.
insert into public.accounts (user_id, email, paid)
select id, email, false
from auth.users
on conflict (user_id) do nothing;

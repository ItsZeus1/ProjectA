-- =====================================================================
-- NovaCharge — Supabase schema (Phase 1)
-- Run the whole file in Supabase Dashboard -> SQL Editor. It is idempotent.
-- =====================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------
-- 0. ENUMS
-- ---------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'user_role') then
    create type public.user_role as enum ('NORMAL', 'VIP', 'ADMIN');
  end if;
  if not exists (select 1 from pg_type where typname = 'order_status') then
    create type public.order_status as enum ('PENDING', 'COMPLETED', 'FAILED');
  end if;
  if not exists (select 1 from pg_type where typname = 'ledger_type') then
    create type public.ledger_type as enum ('TOPUP', 'PURCHASE', 'REFUND', 'ADMIN_ADJUST');
  end if;
end
$$;

-- ---------------------------------------------------------------------
-- 1. ZERO EMAIL CONFIRMATION
--    Every new auth user is confirmed the moment it is inserted.
-- ---------------------------------------------------------------------
create or replace function public.auto_confirm_email()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  new.email_confirmed_at := coalesce(new.email_confirmed_at, now());
  return new;
end;
$$;

drop trigger if exists on_auth_user_auto_confirm on auth.users;
create trigger on_auth_user_auto_confirm
  before insert on auth.users
  for each row execute function public.auto_confirm_email();

-- Un-stick every account that was created before this trigger existed.
update auth.users set email_confirmed_at = now() where email_confirmed_at is null;

-- ---------------------------------------------------------------------
-- 2. SHARED HELPERS
-- ---------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create or replace function public.is_hardcoded_admin(p_email text)
returns boolean
language sql
immutable
as $$
  select lower(coalesce(p_email, '')) = 'majd@elmadani.com';
$$;

-- ---------------------------------------------------------------------
-- 3. PROFILES
-- ---------------------------------------------------------------------
create table if not exists public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  name         text        not null,
  username     text        not null,
  email        text        not null,
  role         public.user_role not null default 'NORMAL',
  balance      numeric(12, 2)   not null default 0.00 check (balance >= 0),
  last_ip      text,
  last_seen_at timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create unique index if not exists profiles_username_lower_key on public.profiles (lower(username));
create unique index if not exists profiles_email_lower_key    on public.profiles (lower(email));
create index        if not exists profiles_role_idx           on public.profiles (role);
create index        if not exists profiles_last_seen_idx      on public.profiles (last_seen_at desc);

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- 4. CATALOGUE: SERVICES, PACKAGES, SECRETS, PROMO BANNERS
-- ---------------------------------------------------------------------
create table if not exists public.services (
  id           uuid primary key default gen_random_uuid(),
  slug         text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name         text not null,
  category     text not null check (category in ('games', 'apps', 'subscriptions', 'mobile')),
  image_url    text not null default '',
  description  text not null default '',
  instructions text not null default 'Enter your Player / Account ID exactly as it appears in the app, choose a package and confirm your purchase.',
  is_active    boolean not null default true,
  sort_order   integer not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists services_category_idx on public.services (category, sort_order);

drop trigger if exists services_set_updated_at on public.services;
create trigger services_set_updated_at
  before update on public.services
  for each row execute function public.set_updated_at();

create table if not exists public.service_packages (
  id           uuid primary key default gen_random_uuid(),
  service_id   uuid not null references public.services (id) on delete cascade,
  name         text not null,
  normal_price numeric(12, 2) not null check (normal_price >= 0),
  vip_price    numeric(12, 2) not null check (vip_price >= 0),
  is_active    boolean not null default true,
  sort_order   integer not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (service_id, name)
);

create index if not exists service_packages_service_idx on public.service_packages (service_id, sort_order);

drop trigger if exists service_packages_set_updated_at on public.service_packages;
create trigger service_packages_set_updated_at
  before update on public.service_packages
  for each row execute function public.set_updated_at();

-- Secrets live in their OWN table so row-level security can hide them from
-- every non-admin. Row security cannot hide individual columns.
create table if not exists public.package_secrets (
  package_id      uuid primary key references public.service_packages (id) on delete cascade,
  api_endpoint    text not null default '',
  api_secret_code text not null default '',
  updated_at      timestamptz not null default now()
);

drop trigger if exists package_secrets_set_updated_at on public.package_secrets;
create trigger package_secrets_set_updated_at
  before update on public.package_secrets
  for each row execute function public.set_updated_at();

create table if not exists public.promo_banners (
  id         uuid primary key default gen_random_uuid(),
  title      text not null,
  subtitle   text not null default '',
  badge_text text not null default '',
  cta_label  text not null default 'Shop now',
  cta_href   text not null default '/',
  gradient   text not null default 'from-violet-600 via-fuchsia-500 to-indigo-600',
  image_url  text not null default '',
  is_active  boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 5. ORDERS + WALLET LEDGER
-- ---------------------------------------------------------------------
create table if not exists public.orders (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.profiles (id) on delete cascade,
  service_id   uuid references public.services (id) on delete set null,
  package_id   uuid references public.service_packages (id) on delete set null,
  -- Snapshots so history survives later edits / deletes of the catalogue.
  service_name text not null,
  service_slug text not null default '',
  package_name text not null,
  price        numeric(12, 2) not null check (price >= 0),
  role_at_purchase public.user_role not null default 'NORMAL',
  target_id    text not null,
  user_ip      text not null default 'unknown',
  status       public.order_status not null default 'PENDING',
  api_response jsonb,
  created_at   timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists orders_user_idx    on public.orders (user_id, created_at desc);
create index if not exists orders_created_idx on public.orders (created_at desc);
create index if not exists orders_status_idx  on public.orders (status);

create table if not exists public.wallet_ledger (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.profiles (id) on delete cascade,
  amount        numeric(12, 2) not null,              -- positive = credit, negative = debit
  type          public.ledger_type not null,
  balance_after numeric(12, 2) not null,
  note          text not null default '',
  order_id      uuid references public.orders (id) on delete set null,
  created_by    uuid references public.profiles (id) on delete set null,
  created_at    timestamptz not null default now()
);

create index if not exists wallet_ledger_user_idx on public.wallet_ledger (user_id, created_at desc);

-- ---------------------------------------------------------------------
-- 6. ROLE HELPER (security definer => no RLS recursion on profiles)
-- ---------------------------------------------------------------------
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles where id = auth.uid() and role = 'ADMIN'
  );
$$;

-- ---------------------------------------------------------------------
-- 7. NEW-USER TRIGGER: builds the profile, auto-promotes the hardcoded admin
-- ---------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_name     text;
  v_base     text;
  v_username text;
  v_tries    integer := 0;
  v_role     public.user_role := 'NORMAL';
  v_balance  numeric(12, 2)   := 0.00;
begin
  v_name := coalesce(nullif(trim(new.raw_user_meta_data ->> 'name'), ''), split_part(new.email, '@', 1));

  v_base := lower(regexp_replace(
              coalesce(nullif(trim(new.raw_user_meta_data ->> 'username'), ''), split_part(new.email, '@', 1)),
              '[^a-zA-Z0-9_]', '', 'g'));
  if length(v_base) < 3 then
    v_base := 'user' || substr(replace(new.id::text, '-', ''), 1, 6);
  end if;
  v_base := left(v_base, 24);

  v_username := v_base;
  while exists (select 1 from public.profiles where lower(username) = v_username) and v_tries < 10 loop
    v_tries    := v_tries + 1;
    v_username := left(v_base, 20) || substr(replace(gen_random_uuid()::text, '-', ''), 1, 4);
  end loop;

  if public.is_hardcoded_admin(new.email) then
    v_role    := 'ADMIN';
    v_balance := 10000.00;
  end if;

  insert into public.profiles (id, name, username, email, role, balance)
  values (new.id, v_name, v_username, lower(new.email), v_role, v_balance)
  on conflict (id) do nothing;

  if v_role = 'ADMIN' then
    insert into public.wallet_ledger (user_id, amount, type, balance_after, note)
    values (new.id, v_balance, 'ADMIN_ADJUST', v_balance, 'Initial administrator balance');
  end if;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Back-fill profiles for accounts that already exist in auth.users.
insert into public.profiles (id, name, username, email, role, balance)
select u.id,
       coalesce(nullif(trim(u.raw_user_meta_data ->> 'name'), ''), split_part(u.email, '@', 1)),
       left(lower(regexp_replace(split_part(u.email, '@', 1), '[^a-zA-Z0-9_]', '', 'g')), 20)
         || substr(replace(u.id::text, '-', ''), 1, 4),
       lower(u.email),
       case when public.is_hardcoded_admin(u.email) then 'ADMIN'::public.user_role else 'NORMAL'::public.user_role end,
       case when public.is_hardcoded_admin(u.email) then 10000.00 else 0.00 end
from auth.users u
where not exists (select 1 from public.profiles p where p.id = u.id);

-- ---------------------------------------------------------------------
-- 8. CALLABLE FROM THE LOGGED-IN USER SESSION
-- ---------------------------------------------------------------------

-- 8a. Called on every login / signup: forces ADMIN + 10,000.00 for the hardcoded admin email.
create or replace function public.enforce_hardcoded_admin()
returns boolean
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_email text;
begin
  if auth.uid() is null then
    return false;
  end if;

  select email into v_email from auth.users where id = auth.uid();
  if not public.is_hardcoded_admin(v_email) then
    return false;
  end if;

  update public.profiles
     set role = 'ADMIN', balance = 10000.00
   where id = auth.uid();

  return true;
end;
$$;

-- 8b. Presence heartbeat. Throttled to once per minute per user.
create or replace function public.touch_presence(p_ip text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    return;
  end if;

  update public.profiles
     set last_seen_at = now(),
         last_ip      = coalesce(nullif(trim(p_ip), ''), last_ip)
   where id = auth.uid()
     and (last_seen_at is null or last_seen_at < now() - interval '1 minute');
end;
$$;

-- 8c. Live username check for the registration form (also callable while logged out).
create or replace function public.is_username_available(p_username text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select not exists (select 1 from public.profiles where lower(username) = lower(trim(p_username)));
$$;

-- 8d. Admin dashboard KPIs.
create or replace function public.admin_dashboard_stats()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'FORBIDDEN';
  end if;

  return jsonb_build_object(
    'online_sessions', (select count(*) from public.profiles where last_seen_at > now() - interval '15 minutes'),
    'total_services',  (select count(*) from public.services),
    'total_revenue',   (select coalesce(sum(price), 0) from public.orders where status = 'COMPLETED'),
    'total_orders',    (select count(*) from public.orders),
    'total_users',     (select count(*) from public.profiles)
  );
end;
$$;

-- ---------------------------------------------------------------------
-- 9. MONEY-MOVING FUNCTIONS — SERVICE ROLE ONLY
--    Atomic and row-locked so concurrent requests can never overspend.
-- ---------------------------------------------------------------------

-- 9a. Reserve funds + create a PENDING order. Price is decided HERE from the
--     user's real role, never from anything the browser sends.
create or replace function public.purchase_package(
  p_user_id    uuid,
  p_package_id uuid,
  p_target_id  text,
  p_ip         text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile public.profiles%rowtype;
  v_pkg     record;
  v_price   numeric(12, 2);
  v_new_bal numeric(12, 2);
  v_order   uuid;
begin
  if p_target_id is null or length(trim(p_target_id)) < 3 then
    raise exception 'INVALID_TARGET';
  end if;

  select * into v_profile from public.profiles where id = p_user_id for update;
  if not found then
    raise exception 'USER_NOT_FOUND';
  end if;

  select p.id as package_id, p.name as package_name, p.normal_price, p.vip_price,
         p.is_active as package_active,
         s.id as service_id, s.name as service_name, s.slug as service_slug,
         s.is_active as service_active
    into v_pkg
    from public.service_packages p
    join public.services s on s.id = p.service_id
   where p.id = p_package_id;

  if not found then
    raise exception 'PACKAGE_NOT_FOUND';
  end if;
  if not (v_pkg.package_active and v_pkg.service_active) then
    raise exception 'PACKAGE_UNAVAILABLE';
  end if;

  v_price := case when v_profile.role in ('VIP', 'ADMIN') then v_pkg.vip_price else v_pkg.normal_price end;

  if v_profile.balance < v_price then
    raise exception 'INSUFFICIENT_BALANCE';
  end if;

  update public.profiles
     set balance = balance - v_price,
         last_ip = coalesce(nullif(trim(p_ip), ''), last_ip)
   where id = p_user_id
  returning balance into v_new_bal;

  insert into public.orders (user_id, service_id, package_id, service_name, service_slug, package_name,
                             price, role_at_purchase, target_id, user_ip, status)
  values (p_user_id, v_pkg.service_id, v_pkg.package_id, v_pkg.service_name, v_pkg.service_slug,
          v_pkg.package_name, v_price, v_profile.role, trim(p_target_id),
          coalesce(nullif(trim(p_ip), ''), 'unknown'), 'PENDING')
  returning id into v_order;

  insert into public.wallet_ledger (user_id, amount, type, balance_after, note, order_id)
  values (p_user_id, -v_price, 'PURCHASE', v_new_bal, v_pkg.service_name || ' — ' || v_pkg.package_name, v_order);

  return jsonb_build_object('order_id', v_order, 'price', v_price, 'balance', v_new_bal);
end;
$$;

-- 9b. External API succeeded.
create or replace function public.complete_order(p_order_id uuid, p_response jsonb default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.orders
     set status = 'COMPLETED', api_response = p_response, completed_at = now()
   where id = p_order_id and status = 'PENDING';

  if not found then
    raise exception 'ORDER_NOT_PENDING';
  end if;
end;
$$;

-- 9c. External API failed -> mark FAILED and give the money back.
create or replace function public.fail_order_and_refund(p_order_id uuid, p_response jsonb default null)
returns numeric
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order   public.orders%rowtype;
  v_new_bal numeric(12, 2);
begin
  select * into v_order from public.orders where id = p_order_id for update;
  if not found or v_order.status <> 'PENDING' then
    raise exception 'ORDER_NOT_PENDING';
  end if;

  update public.orders
     set status = 'FAILED', api_response = p_response, completed_at = now()
   where id = p_order_id;

  update public.profiles
     set balance = balance + v_order.price
   where id = v_order.user_id
  returning balance into v_new_bal;

  insert into public.wallet_ledger (user_id, amount, type, balance_after, note, order_id)
  values (v_order.user_id, v_order.price, 'REFUND', v_new_bal,
          'Refund: ' || v_order.service_name || ' — ' || v_order.package_name, p_order_id);

  return v_new_bal;
end;
$$;

-- 9d. Admin adds (or removes) wallet funds for any user.
create or replace function public.admin_adjust_balance(
  p_admin_id uuid,
  p_user_id  uuid,
  p_amount   numeric,
  p_note     text default ''
)
returns numeric
language plpgsql
security definer
set search_path = public
as $$
declare
  v_new_bal numeric(12, 2);
begin
  if not exists (select 1 from public.profiles where id = p_admin_id and role = 'ADMIN') then
    raise exception 'FORBIDDEN';
  end if;
  if p_amount is null or p_amount = 0 then
    raise exception 'INVALID_AMOUNT';
  end if;

  update public.profiles
     set balance = balance + round(p_amount, 2)
   where id = p_user_id
  returning balance into v_new_bal;

  if not found then
    raise exception 'USER_NOT_FOUND';
  end if;

  insert into public.wallet_ledger (user_id, amount, type, balance_after, note, created_by)
  values (p_user_id, round(p_amount, 2),
          case when p_amount > 0 then 'TOPUP'::public.ledger_type else 'ADMIN_ADJUST'::public.ledger_type end,
          v_new_bal,
          coalesce(nullif(trim(p_note), ''), 'Balance adjustment by administrator'),
          p_admin_id);

  return v_new_bal;
end;
$$;

-- Lock the money functions down to the service role.
revoke all on function public.purchase_package(uuid, uuid, text, text)          from public, anon, authenticated;
revoke all on function public.complete_order(uuid, jsonb)                       from public, anon, authenticated;
revoke all on function public.fail_order_and_refund(uuid, jsonb)                from public, anon, authenticated;
revoke all on function public.admin_adjust_balance(uuid, uuid, numeric, text)   from public, anon, authenticated;
grant execute on function public.purchase_package(uuid, uuid, text, text)        to service_role;
grant execute on function public.complete_order(uuid, jsonb)                     to service_role;
grant execute on function public.fail_order_and_refund(uuid, jsonb)              to service_role;
grant execute on function public.admin_adjust_balance(uuid, uuid, numeric, text) to service_role;

-- Session-callable helpers.
revoke all on function public.enforce_hardcoded_admin()       from public, anon;
revoke all on function public.touch_presence(text)            from public, anon;
revoke all on function public.admin_dashboard_stats()         from public, anon;
grant execute on function public.enforce_hardcoded_admin()    to authenticated, service_role;
grant execute on function public.touch_presence(text)         to authenticated, service_role;
grant execute on function public.admin_dashboard_stats()      to authenticated, service_role;
grant execute on function public.is_username_available(text)  to anon, authenticated, service_role;
grant execute on function public.is_admin()                   to anon, authenticated, service_role;

-- ---------------------------------------------------------------------
-- 10. ROW LEVEL SECURITY
-- ---------------------------------------------------------------------
alter table public.profiles         enable row level security;
alter table public.services         enable row level security;
alter table public.service_packages enable row level security;
alter table public.package_secrets  enable row level security;
alter table public.promo_banners    enable row level security;
alter table public.orders           enable row level security;
alter table public.wallet_ledger    enable row level security;

-- profiles: read own row (admins read all); only admins may change rows from the client.
drop policy if exists "profiles_select_own_or_admin" on public.profiles;
create policy "profiles_select_own_or_admin" on public.profiles
  for select using (id = auth.uid() or public.is_admin());

drop policy if exists "profiles_update_admin" on public.profiles;
create policy "profiles_update_admin" on public.profiles
  for update using (public.is_admin()) with check (public.is_admin());

-- services: public storefront reads active rows; admins manage everything.
drop policy if exists "services_select_public" on public.services;
create policy "services_select_public" on public.services
  for select using (is_active or public.is_admin());

drop policy if exists "services_admin_all" on public.services;
create policy "services_admin_all" on public.services
  for all using (public.is_admin()) with check (public.is_admin());

-- packages: same rule.
drop policy if exists "packages_select_public" on public.service_packages;
create policy "packages_select_public" on public.service_packages
  for select using (is_active or public.is_admin());

drop policy if exists "packages_admin_all" on public.service_packages;
create policy "packages_admin_all" on public.service_packages
  for all using (public.is_admin()) with check (public.is_admin());

-- secrets: admins ONLY. Fulfilment reads them with the service role on the server.
drop policy if exists "package_secrets_admin_all" on public.package_secrets;
create policy "package_secrets_admin_all" on public.package_secrets
  for all using (public.is_admin()) with check (public.is_admin());

-- banners
drop policy if exists "banners_select_public" on public.promo_banners;
create policy "banners_select_public" on public.promo_banners
  for select using (is_active or public.is_admin());

drop policy if exists "banners_admin_all" on public.promo_banners;
create policy "banners_admin_all" on public.promo_banners
  for all using (public.is_admin()) with check (public.is_admin());

-- orders / ledger: owners read their own, admins read all, nobody writes from the client.
drop policy if exists "orders_select_own_or_admin" on public.orders;
create policy "orders_select_own_or_admin" on public.orders
  for select using (user_id = auth.uid() or public.is_admin());

drop policy if exists "ledger_select_own_or_admin" on public.wallet_ledger;
create policy "ledger_select_own_or_admin" on public.wallet_ledger
  for select using (user_id = auth.uid() or public.is_admin());

-- ---------------------------------------------------------------------
-- 11. SEED DATA — 8 services across all 4 categories
--     API endpoints / codes below are SIMULATED placeholders. Replace them
--     from the admin panel with your real provider values.
-- ---------------------------------------------------------------------
insert into public.services (slug, name, category, image_url, description, instructions, sort_order) values
  ('pubg-mobile-uc', 'PUBG Mobile UC', 'games',
   'https://placehold.co/800x450/1e1b4b/c4b5fd?text=PUBG+Mobile',
   'Top up Unknown Cash (UC) for PUBG Mobile instantly. Unlock Royale Passes, skins and crates in minutes.',
   'Open PUBG Mobile, tap your avatar and copy the Character ID shown under your nickname. Paste it below and choose a UC pack.',
   1),
  ('free-fire-diamonds', 'Free Fire Diamonds', 'games',
   'https://placehold.co/800x450/4c0519/fda4af?text=Free+Fire',
   'Instant Garena Free Fire Diamonds and memberships delivered straight to your player ID.',
   'Open Free Fire, tap your profile picture and copy the Player ID (UID). Paste it below and pick a Diamond pack.',
   2),
  ('tiktok-coins', 'TikTok Coins', 'apps',
   'https://placehold.co/800x450/083344/67e8f9?text=TikTok+Coins',
   'Recharge TikTok Coins to send gifts to your favourite creators and support live streams.',
   'Enter your TikTok @username (without the @) exactly as it appears on your profile.',
   3),
  ('bigo-live-diamonds', 'Bigo Live Diamonds', 'apps',
   'https://placehold.co/800x450/052e16/86efac?text=Bigo+Live',
   'Bigo Live Diamonds for gifts, VIP levels and live-room perks. Delivered in under five minutes.',
   'Open Bigo Live, go to Me and copy your Bigo ID. Paste it below and choose a Diamond bundle.',
   4),
  ('playstation-gift-cards', 'PlayStation Store Gift Cards', 'subscriptions',
   'https://placehold.co/800x450/172554/93c5fd?text=PlayStation',
   'PlayStation Store wallet credit for games, DLC and PS Plus. Code delivered to your account email.',
   'Enter the PSN account email that should receive the wallet credit.',
   5),
  ('netflix-subscription', 'Netflix Subscription', 'subscriptions',
   'https://placehold.co/800x450/450a0a/fca5a5?text=Netflix',
   'Activate or extend a Netflix plan without a credit card. Basic, Standard and Premium tiers available.',
   'Enter the email address of the Netflix account you want to activate or extend.',
   6),
  ('mobile-recharge', 'Global Mobile Top-Up', 'mobile',
   'https://placehold.co/800x450/422006/fde047?text=Mobile+Top-Up',
   'Instant airtime for hundreds of carriers worldwide. Credit lands on the phone in seconds.',
   'Enter the full phone number including the country code, for example 31612345678.',
   7),
  ('data-bundles', 'Mobile Data Bundles', 'mobile',
   'https://placehold.co/800x450/3b0764/e9d5ff?text=Data+Bundles',
   'Prepaid internet bundles from 1 GB to 50 GB. Choose the validity that fits your usage.',
   'Enter the full phone number including the country code, for example 31612345678.',
   8)
on conflict (slug) do nothing;

with pkg (slug, name, normal_price, vip_price, endpoint, code, ord) as (
  values
  -- PUBG Mobile UC
  ('pubg-mobile-uc', '60 UC',   0.99,  0.89,  'https://api.provider.example/v1/pubg/topup', 'PUBG-UC-60',   1),
  ('pubg-mobile-uc', '325 UC',  4.99,  4.49,  'https://api.provider.example/v1/pubg/topup', 'PUBG-UC-325',  2),
  ('pubg-mobile-uc', '660 UC',  9.99,  8.99,  'https://api.provider.example/v1/pubg/topup', 'PUBG-UC-660',  3),
  ('pubg-mobile-uc', '1800 UC', 24.99, 22.49, 'https://api.provider.example/v1/pubg/topup', 'PUBG-UC-1800', 4),
  ('pubg-mobile-uc', '3850 UC', 49.99, 44.99, 'https://api.provider.example/v1/pubg/topup', 'PUBG-UC-3850', 5),
  -- Free Fire
  ('free-fire-diamonds', '100 Diamonds',     0.99, 0.90, 'https://api.provider.example/v1/freefire/topup', 'FF-D-100',  1),
  ('free-fire-diamonds', '310 Diamonds',     2.99, 2.69, 'https://api.provider.example/v1/freefire/topup', 'FF-D-310',  2),
  ('free-fire-diamonds', '520 Diamonds',     4.99, 4.49, 'https://api.provider.example/v1/freefire/topup', 'FF-D-520',  3),
  ('free-fire-diamonds', '1060 Diamonds',    9.99, 8.99, 'https://api.provider.example/v1/freefire/topup', 'FF-D-1060', 4),
  ('free-fire-diamonds', 'Weekly Membership', 1.99, 1.79, 'https://api.provider.example/v1/freefire/topup', 'FF-MEM-W', 5),
  -- TikTok Coins
  ('tiktok-coins', '70 Coins',   0.99,  0.92,  'https://api.provider.example/v1/tiktok/coins', 'TT-C-70',   1),
  ('tiktok-coins', '350 Coins',  4.99,  4.59,  'https://api.provider.example/v1/tiktok/coins', 'TT-C-350',  2),
  ('tiktok-coins', '700 Coins',  9.99,  9.19,  'https://api.provider.example/v1/tiktok/coins', 'TT-C-700',  3),
  ('tiktok-coins', '1400 Coins', 19.99, 18.39, 'https://api.provider.example/v1/tiktok/coins', 'TT-C-1400', 4),
  ('tiktok-coins', '3500 Coins', 49.99, 45.99, 'https://api.provider.example/v1/tiktok/coins', 'TT-C-3500', 5),
  -- Bigo Live
  ('bigo-live-diamonds', '50 Diamonds',   0.80,  0.72,  'https://api.provider.example/v1/bigo/diamonds', 'BIGO-D-50',   1),
  ('bigo-live-diamonds', '100 Diamonds',  1.60,  1.45,  'https://api.provider.example/v1/bigo/diamonds', 'BIGO-D-100',  2),
  ('bigo-live-diamonds', '500 Diamonds',  7.90,  7.10,  'https://api.provider.example/v1/bigo/diamonds', 'BIGO-D-500',  3),
  ('bigo-live-diamonds', '1000 Diamonds', 15.80, 14.20, 'https://api.provider.example/v1/bigo/diamonds', 'BIGO-D-1000', 4),
  ('bigo-live-diamonds', '5000 Diamonds', 78.00, 70.00, 'https://api.provider.example/v1/bigo/diamonds', 'BIGO-D-5000', 5),
  -- PlayStation
  ('playstation-gift-cards', '$10 Gift Card',  10.99,  10.19, 'https://api.provider.example/v1/psn/giftcard', 'PSN-10',  1),
  ('playstation-gift-cards', '$25 Gift Card',  26.99,  25.19, 'https://api.provider.example/v1/psn/giftcard', 'PSN-25',  2),
  ('playstation-gift-cards', '$50 Gift Card',  52.99,  49.49, 'https://api.provider.example/v1/psn/giftcard', 'PSN-50',  3),
  ('playstation-gift-cards', '$100 Gift Card', 104.99, 98.99, 'https://api.provider.example/v1/psn/giftcard', 'PSN-100', 4),
  -- Netflix
  ('netflix-subscription', 'Basic — 1 Month',     8.99,  8.19,  'https://api.provider.example/v1/netflix/activate', 'NFX-BASIC-1',  1),
  ('netflix-subscription', 'Standard — 1 Month',  13.99, 12.79, 'https://api.provider.example/v1/netflix/activate', 'NFX-STD-1',    2),
  ('netflix-subscription', 'Premium — 1 Month',   18.99, 17.29, 'https://api.provider.example/v1/netflix/activate', 'NFX-PREM-1',   3),
  ('netflix-subscription', 'Standard — 3 Months', 40.99, 37.49, 'https://api.provider.example/v1/netflix/activate', 'NFX-STD-3',    4),
  -- Mobile airtime
  ('mobile-recharge', '$5 Airtime',  5.25,  4.95,  'https://api.provider.example/v1/telecom/airtime', 'AIR-5',  1),
  ('mobile-recharge', '$10 Airtime', 10.50, 9.90,  'https://api.provider.example/v1/telecom/airtime', 'AIR-10', 2),
  ('mobile-recharge', '$20 Airtime', 20.90, 19.70, 'https://api.provider.example/v1/telecom/airtime', 'AIR-20', 3),
  ('mobile-recharge', '$50 Airtime', 51.50, 48.60, 'https://api.provider.example/v1/telecom/airtime', 'AIR-50', 4),
  -- Data bundles
  ('data-bundles', '1 GB — 3 Days',   1.99,  1.79,  'https://api.provider.example/v1/telecom/data', 'DATA-1G-3D',   1),
  ('data-bundles', '5 GB — 7 Days',   5.99,  5.39,  'https://api.provider.example/v1/telecom/data', 'DATA-5G-7D',   2),
  ('data-bundles', '15 GB — 30 Days', 13.99, 12.59, 'https://api.provider.example/v1/telecom/data', 'DATA-15G-30D', 3),
  ('data-bundles', '50 GB — 30 Days', 29.99, 26.99, 'https://api.provider.example/v1/telecom/data', 'DATA-50G-30D', 4)
),
inserted as (
  insert into public.service_packages (service_id, name, normal_price, vip_price, sort_order)
  select s.id, p.name, p.normal_price, p.vip_price, p.ord
    from pkg p
    join public.services s on s.slug = p.slug
  on conflict (service_id, name) do nothing
  returning id, service_id, name
)
insert into public.package_secrets (package_id, api_endpoint, api_secret_code)
select i.id, p.endpoint, p.code
  from inserted i
  join public.services s on s.id = i.service_id
  join pkg p on p.slug = s.slug and p.name = i.name
on conflict (package_id) do nothing;

insert into public.promo_banners (title, subtitle, badge_text, cta_label, cta_href, gradient, sort_order)
select * from (values
  ('Instant Top-Ups for Every Game', 'PUBG, Free Fire and more delivered in under 5 minutes.', '-15% this week', 'Browse Games', '/category/games',
   'from-violet-600 via-fuchsia-500 to-indigo-600', 1),
  ('Go VIP, Pay Less Forever', 'Unlock exclusive VIP rates on every single package.', 'VIP Rates', 'See VIP Prices', '/category/apps',
   'from-amber-500 via-orange-500 to-rose-600', 2),
  ('Streaming and Gift Cards', 'Netflix and PlayStation credit without a credit card.', 'New', 'Explore Subscriptions', '/category/subscriptions',
   'from-cyan-500 via-sky-500 to-indigo-600', 3)
) as v (title, subtitle, badge_text, cta_label, cta_href, gradient, sort_order)
where not exists (select 1 from public.promo_banners);

-- ---------------------------------------------------------------------
-- 12. FINAL SAFETY NET
--     If the hardcoded admin already exists, make sure the role is applied now.
-- ---------------------------------------------------------------------
update public.profiles
   set role = 'ADMIN', balance = greatest(balance, 10000.00)
 where public.is_hardcoded_admin(email);

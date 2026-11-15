-- =====================================================================
-- NEXORA Seller Dashboard V1 — Schéma Supabase / PostgreSQL
-- Migration initiale : tables, contraintes, triggers, RLS
-- =====================================================================

create extension if not exists "pgcrypto";

-- ---------- Types ----------
create type user_role as enum ('member', 'admin');
create type listing_status as enum
  ('draft','pending','active','reserved','sold','rejected','archived');
create type listing_region as enum ('europe','global','asia');
create type transaction_status as enum
  ('requested','buyer_identified','price_agreed','middleman_engaged',
   'payment_transfer_tracked','completed','cancelled');
create type inquiry_status as enum ('open','converted','closed');
create type report_status as enum ('open','reviewing','resolved','dismissed');

-- ---------- Profils ----------
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  seller_number bigint generated always as identity unique,   -- nexora.gg/seller/{n}
  handle text unique not null check (handle ~ '^[A-Za-z0-9_.-]{3,24}$'),
  display_name text,
  bio text,
  discord_handle text,
  locale text not null default 'fr',
  role user_role not null default 'member',
  is_suspended boolean not null default false,
  created_at timestamptz not null default now()
);

-- Création automatique du profil à l'inscription
create or replace function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, handle)
  values (new.id, 'user_' || substr(replace(new.id::text,'-',''),1,10));
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function handle_new_user();

-- Helper admin (security definer pour éviter la récursion RLS)
create or replace function is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and role = 'admin');
$$;

-- Interdit l'auto-promotion et la modification de champs système
create or replace function guard_profile_update() returns trigger
language plpgsql as $$
begin
  if not is_admin() then
    new.role := old.role;
    new.is_suspended := old.is_suspended;
    new.seller_number := old.seller_number;
  end if;
  return new;
end $$;
create trigger trg_guard_profile before update on profiles
  for each row execute function guard_profile_update();

-- ---------- Annonces ----------
create table listings (
  id uuid primary key default gen_random_uuid(),
  ref text unique,                                   -- NX-0001 (trigger)
  seller_id uuid not null references profiles(id) on delete restrict,
  title text not null check (char_length(title) between 5 and 120),
  region listing_region not null,
  price_cents integer not null check (price_cents > 0),
  currency char(3) not null default 'EUR',
  description text not null default '',
  status listing_status not null default 'draft',
  admin_feedback text,                               -- motif refus / corrections demandées
  views_count integer not null default 0,
  submitted_at timestamptz,
  published_at timestamptz,
  reserved_at timestamptz,
  sold_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on listings (seller_id);
create index on listings (status, published_at desc);

create sequence listing_ref_seq;
create or replace function set_listing_ref() returns trigger
language plpgsql as $$
begin
  new.ref := 'NX-' || lpad(nextval('listing_ref_seq')::text, 4, '0');
  return new;
end $$;
create trigger trg_listing_ref before insert on listings
  for each row execute function set_listing_ref();

create table listing_monsters (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references listings(id) on delete cascade,
  monster_name text not null,
  is_ld5 boolean not null default false,
  note text
);
create index on listing_monsters (listing_id);
create index on listing_monsters (lower(monster_name));

create table listing_images (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references listings(id) on delete cascade,
  storage_path text not null,                        -- bucket Supabase Storage
  position smallint not null default 0
);
create index on listing_images (listing_id, position);

-- Règles de transition (côté serveur, indépendamment du front)
create or replace function enforce_listing_rules() returns trigger
language plpgsql as $$
declare admin boolean := is_admin();
begin
  new.updated_at := now();

  if admin then
    if new.status = 'active' and old.status is distinct from 'active' then
      new.published_at := coalesce(new.published_at, now());
      new.admin_feedback := null;
    end if;
    return new;
  end if;

  -- Vendeur : ne touche pas aux champs système
  new.seller_id := old.seller_id;
  new.ref := old.ref;
  new.views_count := old.views_count;
  new.admin_feedback := old.admin_feedback;
  new.published_at := old.published_at;
  new.reserved_at := old.reserved_at;
  new.sold_at := old.sold_at;

  if new.status is distinct from old.status then
    if not (
      (old.status = 'draft'    and new.status in ('pending','archived')) or
      (old.status = 'pending'  and new.status = 'draft') or
      (old.status = 'rejected' and new.status in ('draft','archived')) or
      (old.status = 'active'   and new.status = 'archived') or
      (old.status = 'archived' and new.status = 'draft')
    ) then
      raise exception 'Transition de statut interdite pour un vendeur : % -> %', old.status, new.status;
    end if;
    if new.status = 'pending' then new.submitted_at := now(); end if;
  elsif old.status in ('reserved','sold') then
    raise exception 'Annonce % non modifiable par le vendeur', old.status;
  elsif old.status = 'active'
    and (new.title, new.price_cents, new.region, new.description)
        is distinct from (old.title, old.price_cents, old.region, old.description) then
    -- Modification sensible : revalidation obligatoire
    new.status := 'pending';
    new.submitted_at := now();
  end if;
  return new;
end $$;
create trigger trg_listing_rules before update on listings
  for each row execute function enforce_listing_rules();

-- À l'insertion, un vendeur ne peut créer qu'un brouillon
create or replace function enforce_listing_insert() returns trigger
language plpgsql as $$
begin
  if not is_admin() then
    new.status := 'draft';
    new.admin_feedback := null;
    new.published_at := null; new.reserved_at := null; new.sold_at := null;
    new.views_count := 0;
  end if;
  return new;
end $$;
create trigger trg_listing_insert before insert on listings
  for each row execute function enforce_listing_insert();

-- ---------- Demandes (acheteur -> NEXORA) ----------
create table inquiries (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references listings(id) on delete cascade,
  buyer_id uuid not null references profiles(id) on delete cascade,
  message text,
  status inquiry_status not null default 'open',
  created_at timestamptz not null default now(),
  unique (listing_id, buyer_id)
);

-- ---------- Transactions (admin uniquement en écriture) ----------
create table transactions (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references listings(id) on delete restrict,
  seller_id uuid not null references profiles(id),
  buyer_id uuid not null references profiles(id),
  agreed_price_cents integer check (agreed_price_cents > 0),
  fee_cents integer,                                  -- 6 %, min 5 €
  status transaction_status not null default 'requested',
  admin_notes text,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  check (seller_id <> buyer_id)
);
-- Une seule transaction en cours par annonce (anti double vente)
create unique index one_open_tx_per_listing on transactions (listing_id)
  where status not in ('cancelled');

create or replace function middleman_fee_cents(price_cents integer) returns integer
language sql immutable as $$
  select greatest(round(price_cents * 0.06)::integer, 500);
$$;

create or replace function transaction_lifecycle() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.agreed_price_cents is not null then
    new.fee_cents := middleman_fee_cents(new.agreed_price_cents);
  end if;

  if tg_op = 'INSERT' then
    update listings set status = 'reserved', reserved_at = now()
      where id = new.listing_id and status = 'active';
    if not found then
      raise exception 'Annonce non disponible (doit être Active)';
    end if;
  elsif new.status is distinct from old.status then
    if new.status = 'completed' then
      new.completed_at := now();
      update listings set status = 'sold', sold_at = now() where id = new.listing_id;
    elsif new.status = 'cancelled' then
      update listings set status = 'active', reserved_at = null
        where id = new.listing_id and status = 'reserved';
    end if;
  end if;
  return new;
end $$;
create trigger trg_tx_lifecycle before insert or update on transactions
  for each row execute function transaction_lifecycle();

-- ---------- Avis (transactions vérifiées uniquement) ----------
create table reviews (
  id uuid primary key default gen_random_uuid(),
  transaction_id uuid not null unique references transactions(id) on delete cascade,
  reviewer_id uuid not null references profiles(id),
  seller_id uuid not null references profiles(id),
  rating smallint not null check (rating between 1 and 5),
  comment text check (char_length(comment) <= 1000),
  created_at timestamptz not null default now()
);

create or replace function check_review() returns trigger
language plpgsql security definer set search_path = public as $$
declare t transactions;
begin
  select * into t from transactions where id = new.transaction_id;
  if t.status <> 'completed' or t.buyer_id <> new.reviewer_id then
    raise exception 'Avis réservé à l''acheteur d''une transaction terminée';
  end if;
  new.seller_id := t.seller_id;
  return new;
end $$;
create trigger trg_review_check before insert on reviews
  for each row execute function check_review();

-- ---------- Notifications & signalements ----------
create table notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  kind text not null,
  payload jsonb not null default '{}',
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index on notifications (user_id, read_at);

create table reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references profiles(id) on delete cascade,
  listing_id uuid references listings(id) on delete set null,
  reported_user_id uuid references profiles(id) on delete set null,
  reason text not null,
  status report_status not null default 'open',
  created_at timestamptz not null default now(),
  check (listing_id is not null or reported_user_id is not null)
);

-- ---------- Statistiques vendeur (données vérifiées uniquement) ----------
create view seller_stats with (security_invoker = true) as
select
  p.id as seller_id,
  count(l.*) filter (where l.status <> 'archived')              as total_listings,
  count(l.*) filter (where l.status = 'active')                 as active_count,
  count(l.*) filter (where l.status = 'reserved')               as reserved_count,
  count(l.*) filter (where l.status = 'sold')                   as sold_count,
  coalesce(sum(t.agreed_price_cents) filter (where t.status='completed'),0) as gross_cents,
  coalesce(sum(t.fee_cents)          filter (where t.status='completed'),0) as fees_cents,
  coalesce(avg(t.agreed_price_cents) filter (where t.status='completed'),0)::int as avg_price_cents,
  (select round(avg(r.rating),2) from reviews r where r.seller_id = p.id) as avg_rating,
  (select count(*) from reviews r where r.seller_id = p.id)              as reviews_count
from profiles p
left join listings l on l.seller_id = p.id
left join transactions t on t.seller_id = p.id
group by p.id;

-- =====================================================================
-- Row Level Security
-- =====================================================================
alter table profiles          enable row level security;
alter table listings          enable row level security;
alter table listing_monsters  enable row level security;
alter table listing_images    enable row level security;
alter table inquiries         enable row level security;
alter table transactions      enable row level security;
alter table reviews           enable row level security;
alter table notifications     enable row level security;
alter table reports           enable row level security;

-- profiles : lecture publique (storefront), écriture sur soi-même
create policy profiles_read   on profiles for select using (true);
create policy profiles_update on profiles for update
  using (id = auth.uid() or is_admin());

-- listings
create policy listings_public_read on listings for select
  using (status in ('active','reserved','sold'));
create policy listings_owner_read on listings for select
  using (seller_id = auth.uid());
create policy listings_admin_all on listings for all
  using (is_admin()) with check (is_admin());
create policy listings_owner_insert on listings for insert
  with check (seller_id = auth.uid()
              and not exists (select 1 from profiles where id = auth.uid() and is_suspended));
create policy listings_owner_update on listings for update
  using (seller_id = auth.uid()) with check (seller_id = auth.uid());
-- Pas de DELETE vendeur : on archive.

-- monsters / images : suivent la visibilité de l'annonce
create policy monsters_read on listing_monsters for select using (
  exists (select 1 from listings l where l.id = listing_id
          and (l.seller_id = auth.uid() or l.status in ('active','reserved','sold') or is_admin())));
create policy monsters_write on listing_monsters for all using (
  exists (select 1 from listings l where l.id = listing_id
          and (l.seller_id = auth.uid() or is_admin())))
  with check (exists (select 1 from listings l where l.id = listing_id
          and (l.seller_id = auth.uid() or is_admin())));

create policy images_read on listing_images for select using (
  exists (select 1 from listings l where l.id = listing_id
          and (l.seller_id = auth.uid() or l.status in ('active','reserved','sold') or is_admin())));
create policy images_write on listing_images for all using (
  exists (select 1 from listings l where l.id = listing_id
          and (l.seller_id = auth.uid() or is_admin())))
  with check (exists (select 1 from listings l where l.id = listing_id
          and (l.seller_id = auth.uid() or is_admin())));

-- inquiries : l'acheteur crée/voit les siennes, le vendeur voit celles de ses annonces
create policy inq_insert on inquiries for insert with check (
  buyer_id = auth.uid()
  and exists (select 1 from listings l where l.id = listing_id
              and l.status = 'active' and l.seller_id <> auth.uid()));
create policy inq_read on inquiries for select using (
  buyer_id = auth.uid() or is_admin()
  or exists (select 1 from listings l where l.id = listing_id and l.seller_id = auth.uid()));
create policy inq_admin_update on inquiries for update
  using (is_admin()) with check (is_admin());

-- transactions : lecture parties concernées, écriture admin uniquement
create policy tx_read on transactions for select
  using (seller_id = auth.uid() or buyer_id = auth.uid() or is_admin());
create policy tx_admin_write on transactions for all
  using (is_admin()) with check (is_admin());

-- reviews : lecture publique, insertion contrôlée par trigger
create policy reviews_read on reviews for select using (true);
create policy reviews_insert on reviews for insert with check (reviewer_id = auth.uid());

-- notifications : personnelles
create policy notif_own on notifications for select using (user_id = auth.uid());
create policy notif_mark_read on notifications for update using (user_id = auth.uid());

-- reports : création par tout membre, traitement par admin
create policy reports_insert on reports for insert with check (reporter_id = auth.uid());
create policy reports_read on reports for select
  using (reporter_id = auth.uid() or is_admin());
create policy reports_admin_update on reports for update
  using (is_admin()) with check (is_admin());

-- =====================================================================
-- Storage (à créer dans Supabase) : bucket privé 'listing-images'
-- chemin : {seller_id}/{listing_id}/{fichier}  — policy : (storage.foldername(name))[1] = auth.uid()::text
-- =====================================================================

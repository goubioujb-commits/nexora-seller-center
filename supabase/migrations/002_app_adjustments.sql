-- =====================================================================
-- NEXORA Seller Center — migration 002 (à exécuter APRÈS 001_schema.sql)
-- Ajustements pour l'application : demandes de Middleman, acheteurs non
-- inscrits, nombre de LD5, et création du premier administrateur.
-- =====================================================================

-- 1) Permet de promouvoir un admin depuis l'éditeur SQL de Supabase
--    (auth.uid() est nul dans l'éditeur SQL). Un membre connecté ne peut
--    toujours pas modifier son propre rôle.
create or replace function guard_profile_update() returns trigger
language plpgsql as $$
begin
  if auth.uid() is not null and not is_admin() then
    new.role := old.role;
    new.is_suspended := old.is_suspended;
    new.seller_number := old.seller_number;
  end if;
  return new;
end $$;

-- 2) Nombre de LD5 affiché sur l'annonce
alter table listings
  add column if not exists ld5_count smallint not null default 0
  check (ld5_count between 0 and 60);

-- 3) Un acheteur peut ne pas avoir de compte NEXORA : on garde son pseudo
alter table transactions alter column buyer_id drop not null;
alter table transactions add column if not exists buyer_label text;

-- 4) Demandes de Middleman faites par le vendeur, traitées par l'admin
create type request_status as enum ('open','converted','closed');

create table middleman_requests (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references listings(id) on delete cascade,
  requester_id uuid not null references profiles(id) on delete cascade,
  buyer_label text not null check (char_length(buyer_label) between 2 and 60),
  agreed_price_cents integer not null check (agreed_price_cents > 0),
  status request_status not null default 'open',
  created_at timestamptz not null default now()
);
create index on middleman_requests (requester_id);
create index on middleman_requests (status);

alter table middleman_requests enable row level security;

create policy mmr_insert on middleman_requests for insert with check (
  requester_id = auth.uid()
  and exists (select 1 from listings l
              where l.id = listing_id and l.seller_id = auth.uid() and l.status = 'active'));
create policy mmr_read on middleman_requests for select
  using (requester_id = auth.uid() or is_admin());
create policy mmr_admin_update on middleman_requests for update
  using (is_admin()) with check (is_admin());

-- 5) Premier administrateur — à lancer UNE FOIS, après votre inscription
--    dans l'application, en remplaçant l'email :
--
-- update profiles set role = 'admin'
-- where id = (select id from auth.users where email = 'VOTRE@EMAIL.COM');

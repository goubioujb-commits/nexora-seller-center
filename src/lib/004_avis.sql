-- NEXORA 004 : avis sur les vendeurs (note sur 10 + pseudo de l'auteur)
create table if not exists seller_reviews (
  id uuid primary key default gen_random_uuid(),
  reviewer_id uuid not null references profiles(id) on delete cascade,
  seller_id uuid not null references profiles(id) on delete cascade,
  rating smallint not null check (rating between 1 and 10),
  comment text check (char_length(comment) <= 600),
  created_at timestamptz not null default now(),
  unique (reviewer_id, seller_id),
  check (reviewer_id <> seller_id)
);
create index if not exists seller_reviews_seller on seller_reviews (seller_id, created_at desc);

alter table seller_reviews enable row level security;
drop policy if exists sr_read on seller_reviews;
drop policy if exists sr_insert on seller_reviews;
drop policy if exists sr_update on seller_reviews;
drop policy if exists sr_delete on seller_reviews;
create policy sr_read   on seller_reviews for select to authenticated using (true);
create policy sr_insert on seller_reviews for insert to authenticated with check (reviewer_id = auth.uid());
create policy sr_update on seller_reviews for update to authenticated using (reviewer_id = auth.uid()) with check (reviewer_id = auth.uid());
create policy sr_delete on seller_reviews for delete to authenticated using (reviewer_id = auth.uid() or public.is_admin());

select count(*) as table_avis from information_schema.tables where table_name = 'seller_reviews';

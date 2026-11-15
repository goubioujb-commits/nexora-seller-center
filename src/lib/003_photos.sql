-- NEXORA 003 : photos des comptes (max 20 par annonce) + bucket privé
-- À exécuter une fois dans Supabase > SQL Editor.

-- 1. Bucket privé (images jpeg/png/webp, 5 Mo max chacune)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('listing-images', 'listing-images', false, 5242880, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update
  set public = false, file_size_limit = 5242880,
      allowed_mime_types = array['image/jpeg','image/png','image/webp'];

-- 2. Droits sur les fichiers : chaque vendeur écrit dans son dossier <son id>/...
drop policy if exists li_insert on storage.objects;
drop policy if exists li_select on storage.objects;
drop policy if exists li_delete on storage.objects;

create policy li_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'listing-images'
              and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin()));

create policy li_select on storage.objects for select to authenticated
  using (bucket_id = 'listing-images' and (
    (storage.foldername(name))[1] = auth.uid()::text
    or public.is_admin()
    or exists (select 1 from public.listing_images i
               join public.listings l on l.id = i.listing_id
               where i.storage_path = storage.objects.name
                 and l.status in ('active','reserved','sold'))));

create policy li_delete on storage.objects for delete to authenticated
  using (bucket_id = 'listing-images'
         and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin()));

-- 3. Règles côté base : 20 photos max, pas de modification d'une annonce réservée/vendue,
--    toute modification de photos d'une annonce active la renvoie en validation.
create or replace function public.enforce_image_rules() returns trigger
language plpgsql as $$
declare
  lid uuid := coalesce(new.listing_id, old.listing_id);
  st listing_status;
  n int;
begin
  select status into st from public.listings where id = lid;
  if not public.is_admin() then
    if st in ('reserved','sold') then
      raise exception 'Les photos d''une annonce réservée ou vendue ne sont plus modifiables';
    end if;
    if st = 'active' then
      update public.listings set status = 'pending' where id = lid;
    end if;
  end if;
  if tg_op = 'INSERT' then
    select count(*) into n from public.listing_images where listing_id = lid;
    if n >= 20 then raise exception 'Maximum 20 photos par annonce'; end if;
    return new;
  end if;
  return old;
end $$;

drop trigger if exists trg_image_rules on public.listing_images;
create trigger trg_image_rules before insert or delete on public.listing_images
  for each row execute function public.enforce_image_rules();

-- 4. Le vendeur peut renvoyer une annonce active en validation (Active -> En validation)
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
      (old.status = 'active'   and new.status in ('archived','pending')) or
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
    new.status := 'pending';
    new.submitted_at := now();
  end if;
  return new;
end $$;

-- Vérification (doit renvoyer 1, 3 puis 1 ligne)
select (select count(*) from storage.buckets where id = 'listing-images') as bucket,
       (select count(*) from pg_policies where schemaname = 'storage' and policyname like 'li\_%') as policies,
       (select count(*) from pg_trigger where tgname = 'trg_image_rules') as trigger_photos;

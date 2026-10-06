-- Apply only to project bvlcyhcuneaphuletnqz. Inspect existing objects first.
create table if not exists public.categories (
  id text primary key,
  label text not null,
  sort_order integer not null default 0,
  is_public boolean not null default true
);

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  title text not null check (length(btrim(title)) > 0),
  description text not null default '',
  category_id text not null references public.categories(id),
  fillings text[] not null default '{}',
  price numeric(12,2) check (price is null or price >= 0),
  price_unit text check (price_unit in ('кг', 'шт', 'изделие')),
  photos jsonb not null default '[]'::jsonb check (jsonb_typeof(photos) = 'array'),
  primary_photo integer not null default 0 check (primary_photo >= 0),
  sort_order integer not null default 0,
  featured boolean not null default false,
  published boolean not null default false,
  availability text not null default 'unconfirmed' check (availability in ('unconfirmed', 'available', 'unavailable')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists products_public_order_idx on public.products(published, sort_order, slug);
create index if not exists products_category_idx on public.products(category_id);

create table if not exists public.site_settings (
  id boolean primary key default true check (id),
  city text not null default 'Москва',
  whatsapp_number text,
  telegram_username text,
  delivery_text text not null default 'Способ получения и удобное время согласуем при заказе.',
  updated_at timestamptz not null default now()
);

create or replace function public.set_catalog_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
revoke all on function public.set_catalog_updated_at() from public, anon, authenticated;

drop trigger if exists products_updated_at on public.products;
create trigger products_updated_at before update on public.products
for each row execute function public.set_catalog_updated_at();
drop trigger if exists site_settings_updated_at on public.site_settings;
create trigger site_settings_updated_at before update on public.site_settings
for each row execute function public.set_catalog_updated_at();

alter table public.categories enable row level security;
alter table public.products enable row level security;
alter table public.site_settings enable row level security;

revoke all on public.categories, public.products, public.site_settings from anon, authenticated;
grant usage on schema public to anon, authenticated;
grant select on public.categories, public.products, public.site_settings to anon, authenticated;
grant insert, update, delete on public.categories, public.products, public.site_settings to authenticated;

drop policy if exists categories_public_read on public.categories;
create policy categories_public_read on public.categories for select to anon, authenticated
using (is_public);
drop policy if exists categories_owner_read on public.categories;
create policy categories_owner_read on public.categories for select to authenticated
using ((select auth.uid()) = '7ff37aab-19f3-46c0-8842-a28381902bca'::uuid);
drop policy if exists categories_owner_insert on public.categories;
create policy categories_owner_insert on public.categories for insert to authenticated
with check ((select auth.uid()) = '7ff37aab-19f3-46c0-8842-a28381902bca'::uuid);
drop policy if exists categories_owner_update on public.categories;
create policy categories_owner_update on public.categories for update to authenticated
using ((select auth.uid()) = '7ff37aab-19f3-46c0-8842-a28381902bca'::uuid)
with check ((select auth.uid()) = '7ff37aab-19f3-46c0-8842-a28381902bca'::uuid);
drop policy if exists categories_owner_delete on public.categories;
create policy categories_owner_delete on public.categories for delete to authenticated
using ((select auth.uid()) = '7ff37aab-19f3-46c0-8842-a28381902bca'::uuid);

drop policy if exists products_public_read on public.products;
create policy products_public_read on public.products for select to anon, authenticated
using (published);
drop policy if exists products_owner_read on public.products;
create policy products_owner_read on public.products for select to authenticated
using ((select auth.uid()) = '7ff37aab-19f3-46c0-8842-a28381902bca'::uuid);
drop policy if exists products_owner_insert on public.products;
create policy products_owner_insert on public.products for insert to authenticated
with check ((select auth.uid()) = '7ff37aab-19f3-46c0-8842-a28381902bca'::uuid);
drop policy if exists products_owner_update on public.products;
create policy products_owner_update on public.products for update to authenticated
using ((select auth.uid()) = '7ff37aab-19f3-46c0-8842-a28381902bca'::uuid)
with check ((select auth.uid()) = '7ff37aab-19f3-46c0-8842-a28381902bca'::uuid);
drop policy if exists products_owner_delete on public.products;
create policy products_owner_delete on public.products for delete to authenticated
using ((select auth.uid()) = '7ff37aab-19f3-46c0-8842-a28381902bca'::uuid);

drop policy if exists settings_public_read on public.site_settings;
create policy settings_public_read on public.site_settings for select to anon, authenticated using (true);
drop policy if exists settings_owner_insert on public.site_settings;
create policy settings_owner_insert on public.site_settings for insert to authenticated
with check ((select auth.uid()) = '7ff37aab-19f3-46c0-8842-a28381902bca'::uuid);
drop policy if exists settings_owner_update on public.site_settings;
create policy settings_owner_update on public.site_settings for update to authenticated
using ((select auth.uid()) = '7ff37aab-19f3-46c0-8842-a28381902bca'::uuid)
with check ((select auth.uid()) = '7ff37aab-19f3-46c0-8842-a28381902bca'::uuid);
drop policy if exists settings_owner_delete on public.site_settings;
create policy settings_owner_delete on public.site_settings for delete to authenticated
using ((select auth.uid()) = '7ff37aab-19f3-46c0-8842-a28381902bca'::uuid);

-- Private bucket: only published product photos can be signed by visitors.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('milana-catalog', 'milana-catalog', false, 8388608, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

drop policy if exists milana_catalog_published_read on storage.objects;
create policy milana_catalog_published_read on storage.objects for select to anon, authenticated
using (
  bucket_id = 'milana-catalog' and exists (
    select 1 from public.products p
    where p.published and p.photos @> jsonb_build_array(jsonb_build_object('path', name))
  )
);
drop policy if exists milana_catalog_owner_read on storage.objects;
create policy milana_catalog_owner_read on storage.objects for select to authenticated
using (bucket_id = 'milana-catalog' and (select auth.uid()) = '7ff37aab-19f3-46c0-8842-a28381902bca'::uuid);
drop policy if exists milana_catalog_owner_insert on storage.objects;
create policy milana_catalog_owner_insert on storage.objects for insert to authenticated
with check (bucket_id = 'milana-catalog' and name like 'products/%' and (select auth.uid()) = '7ff37aab-19f3-46c0-8842-a28381902bca'::uuid);
drop policy if exists milana_catalog_owner_update on storage.objects;
create policy milana_catalog_owner_update on storage.objects for update to authenticated
using (bucket_id = 'milana-catalog' and (select auth.uid()) = '7ff37aab-19f3-46c0-8842-a28381902bca'::uuid)
with check (bucket_id = 'milana-catalog' and name like 'products/%' and (select auth.uid()) = '7ff37aab-19f3-46c0-8842-a28381902bca'::uuid);
drop policy if exists milana_catalog_owner_delete on storage.objects;
create policy milana_catalog_owner_delete on storage.objects for delete to authenticated
using (bucket_id = 'milana-catalog' and (select auth.uid()) = '7ff37aab-19f3-46c0-8842-a28381902bca'::uuid);

\set ON_ERROR_STOP on
begin;
create role anon;
create role authenticated;
create role service_role;
create table public.products(id uuid default gen_random_uuid(),slug text,title text,published boolean default false,price numeric,photos jsonb,sort_order integer,description text,updated_at timestamptz);
create table public.categories(id text,is_public boolean default true,label text);
create table public.site_settings(id boolean,city text,updated_at timestamptz);
\i supabase/migrations/20261008120000_catalog_static_sync.sql
-- Локальные doubles расширений: проверяют SQL wiring без исходящих запросов.
create schema vault;
create schema net;
create schema cron;
create table vault.decrypted_secrets(name text,decrypted_secret text);
create table public.test_webhook_calls(url text,headers jsonb,body jsonb);
create function net.http_post(url text,headers jsonb,body jsonb,timeout_milliseconds integer) returns bigint language plpgsql as $$
begin
 insert into public.test_webhook_calls values(url,headers,body);
 return 1;
end $$;
create function cron.schedule(text,text,text) returns bigint language sql as $$ select 1::bigint $$;
-- WAKEUP_MIGRATION


do $$
declare a jsonb; b jsonb; rev bigint;
begin
 insert into public.products(slug,title) values('draft','Draft');
 update public.products set title='Draft edit';
 delete from public.products;
 if (select requested from public.catalog_sync_state)<>0 then raise exception 'draft generated event'; end if;
 insert into public.products(slug,title,published) values('public','Public',true);
 update public.products set updated_at=now();
 if (select requested from public.catalog_sync_state)<>1 then raise exception 'metadata generated event'; end if;
 update public.products set photos='[{"path":"test.webp"}]',sort_order=2,description='Changed';
 if (select requested from public.catalog_sync_state)<>2 then raise exception 'photos/order/description missed'; end if;
 update public.products set price=200;
 update public.products set published=false;
 update public.products set title='Hidden edit';
 if (select requested from public.catalog_sync_state)<>4 then raise exception 'public update or hide missed'; end if;
 update public.products set published=true;
 delete from public.products;
 if (select requested from public.catalog_sync_state)<>6 then raise exception 'publish/delete missed'; end if;
 perform public.catalog_sync_wake();
 if exists(select 1 from public.test_webhook_calls) then raise exception 'disabled queue sent webhook'; end if;
 perform public.catalog_sync_enable(true);
 if (select last_error is null from public.catalog_sync_state) then raise exception 'missing webhook secret error lost'; end if;
 insert into vault.decrypted_secrets values('catalog_sync_webhook_secret',repeat('s',32));
 perform public.catalog_sync_wake();
 if not exists(select 1 from public.test_webhook_calls where url='https://bvlcyhcuneaphuletnqz.supabase.co/functions/v1/catalog-static-sync' and headers->>'x-catalog-sync-secret'=repeat('s',32) and body='{"operation":"tick"}'::jsonb) then raise exception 'incorrect webhook'; end if;
 if public.catalog_sync_claim()->>'action'<>'idle' then raise exception 'debounce bypassed'; end if;
 update public.catalog_sync_state set changed_at=now()-interval '3 minutes',first_dirty_at=now()-interval '3 minutes';
 a:=public.catalog_sync_claim();
 if a->>'action'<>'dispatch' then raise exception 'not dispatched'; end if;
 if public.catalog_sync_claim()->>'action'<>'idle' then raise exception 'duplicate dispatch'; end if;
 perform public.catalog_sync_attach((a->>'attempt')::uuid,'123');
 insert into public.categories values('cake',true,'Cake');
 perform public.catalog_sync_finish(gen_random_uuid(),true);
 if (select deployed from public.catalog_sync_state)<>0 then raise exception 'stale callback accepted'; end if;
 perform public.catalog_sync_finish((a->>'attempt')::uuid,true);
 if (select requested<=deployed from public.catalog_sync_state) then raise exception 'change during build lost'; end if;
 update public.catalog_sync_state set changed_at=now()-interval '3 minutes';
 b:=public.catalog_sync_claim();
 perform public.catalog_sync_finish((b->>'attempt')::uuid,false,'test API error');
 if public.catalog_sync_claim()->>'action'<>'idle' then raise exception 'backoff ignored'; end if;
 if has_function_privilege('anon','public.catalog_sync_claim()','execute') then raise exception 'public queue access'; end if;
end $$;
rollback;

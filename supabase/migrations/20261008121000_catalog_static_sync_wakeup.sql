create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron;

create function public.catalog_sync_wake() returns void
language plpgsql security definer set search_path = '' as $$
declare shared_secret text;
begin
  if not exists(select 1 from public.catalog_sync_state where id and enabled and (requested>deployed or attempt is not null)) then return; end if;
  select decrypted_secret into shared_secret from vault.decrypted_secrets where name='catalog_sync_webhook_secret';
  if shared_secret is null or length(shared_secret)<32 then raise exception 'Catalog sync webhook secret is not configured'; end if;
  perform net.http_post(
    url:='https://bvlcyhcuneaphuletnqz.supabase.co/functions/v1/catalog-static-sync',
    headers:=jsonb_build_object('Content-Type','application/json','x-catalog-sync-secret',shared_secret),
    body:='{"operation":"tick"}'::jsonb, timeout_milliseconds:=10000);
exception when others then
  -- Ошибка webhook не должна откатывать сохранение товара; Cron повторит запрос.
  update public.catalog_sync_state set last_error='Webhook enqueue failed (' || sqlstate || ')' where id;
end $$;
create function public.catalog_sync_webhook() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform public.catalog_sync_wake();
  return null;
end $$;
create trigger catalog_sync_webhook after update of requested on public.catalog_sync_state
for each row when (new.requested > old.requested) execute function public.catalog_sync_webhook();
revoke all on function public.catalog_sync_wake(),public.catalog_sync_webhook() from public,anon,authenticated;
-- Очередь выключена по умолчанию; до явного включения запросы не отправляются.
select cron.schedule('catalog-static-sync','* * * * *','select public.catalog_sync_wake()');

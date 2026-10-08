-- Долговечная очередь: событие сохраняется в той же транзакции, что и каталог.
create table public.catalog_sync_state (
  id boolean primary key default true check (id),
  enabled boolean not null default false,
  requested bigint not null default 0,
  deployed bigint not null default 0,
  changed_at timestamptz not null default now(),
  first_dirty_at timestamptz,
  retry_at timestamptz not null default now(),
  attempt uuid,
  revision bigint,
  run_id text,
  lease_until timestamptz,
  failures integer not null default 0,
  last_error text
);
insert into public.catalog_sync_state default values;
create table public.catalog_sync_attempts (
  id uuid primary key,
  revision bigint not null,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  run_id text,
  outcome text,
  error text
);
alter table public.catalog_sync_state enable row level security;
alter table public.catalog_sync_attempts enable row level security;
revoke all on public.catalog_sync_state, public.catalog_sync_attempts from anon, authenticated;

create function public.catalog_sync_changed() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  before_row jsonb := case when tg_op <> 'INSERT' then to_jsonb(old) else '{}'::jsonb end;
  after_row jsonb := case when tg_op <> 'DELETE' then to_jsonb(new) else '{}'::jsonb end;
  visibility text;
begin
  visibility := case tg_table_name when 'products' then 'published' when 'categories' then 'is_public' else null end;
  if visibility is not null and not (coalesce((before_row->>visibility)::boolean,false) or coalesce((after_row->>visibility)::boolean,false)) then
    return null;
  end if;
  -- updated_at меняется при любом сохранении, но сам по себе не меняет страницу.
  if (before_row - 'updated_at' - 'created_at') = (after_row - 'updated_at' - 'created_at') then return null; end if;
  update public.catalog_sync_state set requested = requested + 1,
    changed_at = clock_timestamp(), first_dirty_at = coalesce(first_dirty_at, clock_timestamp()) where id;
  return null;
end $$;
create trigger products_static_sync after insert or update or delete on public.products for each row execute function public.catalog_sync_changed();
create trigger categories_static_sync after insert or update or delete on public.categories for each row execute function public.catalog_sync_changed();
create trigger settings_static_sync after insert or update or delete on public.site_settings for each row execute function public.catalog_sync_changed();

create function public.catalog_sync_finish(p_attempt uuid, p_success boolean, p_error text default null) returns void
language plpgsql security definer set search_path = '' as $$
declare s public.catalog_sync_state;
begin
  select * into s from public.catalog_sync_state where id for update;
  if s.attempt is distinct from p_attempt then return; end if;
  update public.catalog_sync_attempts set finished_at=clock_timestamp(), outcome=case when p_success then 'deployed' else 'failed' end,
    error=left(p_error,1000) where id=p_attempt;
  update public.catalog_sync_state set deployed=case when p_success then greatest(deployed,s.revision) else deployed end,
    first_dirty_at=case when p_success and requested=s.revision then null else first_dirty_at end,
    attempt=null, revision=null, run_id=null, lease_until=null,
    failures=case when p_success then 0 else failures+1 end,
    retry_at=clock_timestamp() + case when p_success then interval '0 seconds' else make_interval(secs => least(3600,60 * power(2,least(s.failures,6)))::double precision) end,
    last_error=case when p_success then null else left(p_error,1000) end where id;
end $$;

create function public.catalog_sync_claim() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare s public.catalog_sync_state; token uuid;
begin
  select * into s from public.catalog_sync_state where id for update skip locked;
  if not found or not s.enabled then return jsonb_build_object('action','idle'); end if;
  if s.attempt is not null then
    if s.run_id is not null then return jsonb_build_object('action','poll','attempt',s.attempt,'run_id',s.run_id); end if;
    -- Истёкшая аренда покрывает аварийное завершение функции до сохранения run_id.
    if s.lease_until > clock_timestamp() then return jsonb_build_object('action','idle'); end if;
    perform public.catalog_sync_finish(s.attempt,false,'Dispatch lease expired; retry');
    return jsonb_build_object('action','idle');
  end if;
  if s.requested <= s.deployed or s.retry_at > clock_timestamp() or
    least(s.changed_at + interval '2 minutes',s.first_dirty_at + interval '10 minutes') > clock_timestamp() then
    return jsonb_build_object('action','idle');
  end if;
  token := gen_random_uuid();
  update public.catalog_sync_state set attempt=token,revision=requested,lease_until=clock_timestamp()+interval '5 minutes' where id;
  insert into public.catalog_sync_attempts(id,revision) values(token,s.requested);
  return jsonb_build_object('action','dispatch','attempt',token,'revision',s.requested::text);
end $$;

create function public.catalog_sync_attach(p_attempt uuid,p_run_id text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  update public.catalog_sync_state set run_id=p_run_id where id and attempt=p_attempt;
  update public.catalog_sync_attempts set run_id=p_run_id where id=p_attempt;
end $$;

create function public.catalog_sync_enable(p_enabled boolean) returns void
language plpgsql security definer set search_path = '' as $$
begin
  update public.catalog_sync_state set enabled=p_enabled, requested=requested+case when p_enabled then 1 else 0 end,
    changed_at=clock_timestamp(), first_dirty_at=case when p_enabled then coalesce(first_dirty_at,clock_timestamp()) else first_dirty_at end where id;
end $$;

-- RPC доступны только серверу; браузерные anon/authenticated не получают очередь или управление.
revoke all on function public.catalog_sync_changed(), public.catalog_sync_finish(uuid,boolean,text), public.catalog_sync_claim(), public.catalog_sync_attach(uuid,text), public.catalog_sync_enable(boolean) from public,anon,authenticated;
grant execute on function public.catalog_sync_finish(uuid,boolean,text), public.catalog_sync_claim(), public.catalog_sync_attach(uuid,text) to service_role;

create function public.catalog_sync_error(p_attempt uuid,p_error text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  update public.catalog_sync_state set last_error=left(p_error,1000) where id and attempt=p_attempt;
  update public.catalog_sync_attempts set error=left(p_error,1000) where id=p_attempt;
end $$;
revoke all on function public.catalog_sync_error(uuid,text) from public,anon,authenticated;
grant execute on function public.catalog_sync_error(uuid,text) to service_role;

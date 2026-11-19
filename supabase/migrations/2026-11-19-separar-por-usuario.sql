-- =====================================================================
-- Separa as cores e o SKU automático por usuário.
-- Pode rodar mais de uma vez sem problema.
-- Rode no Supabase: SQL Editor → New query → cole tudo → Run.
-- =====================================================================

-- 1) Cada cor passa a ter um "dono" (o usuário que cadastrou).
alter table public.colors add column if not exists owner_id uuid;

-- 2) As cores que já existiam ficam com o PRIMEIRO usuário do sistema (o Mario).
update public.colors
set owner_id = (
  select id
  from auth.users
  where raw_app_meta_data ->> 'cadastro_ellos' = 'true'
  order by created_at
  limit 1
)
where owner_id is null;

create index if not exists colors_owner_id_idx on public.colors (owner_id);

-- 3) O "apelido" (slug) da cor deixa de ser único no sistema todo
--    e passa a ser único por pessoa (cada um pode ter o seu "preto").
do $$
declare
  r record;
begin
  -- Remove restrições de unicidade que valem só para a coluna slug.
  for r in
    select con.conname
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_namespace nsp on nsp.oid = rel.relnamespace
    where nsp.nspname = 'public'
      and rel.relname = 'colors'
      and con.contype = 'u'
      and con.conkey = array[(
        select attnum from pg_attribute
        where attrelid = rel.oid and attname = 'slug'
      )]::smallint[]
  loop
    execute format('alter table public.colors drop constraint %I', r.conname);
  end loop;

  -- Remove índices únicos que valem só para a coluna slug.
  for r in
    select idx.relname as index_name
    from pg_index i
    join pg_class idx on idx.oid = i.indexrelid
    join pg_class rel on rel.oid = i.indrelid
    join pg_namespace nsp on nsp.oid = rel.relnamespace
    where nsp.nspname = 'public'
      and rel.relname = 'colors'
      and i.indisunique
      and not i.indisprimary
      and i.indnatts = 1
      and i.indkey[0] = (
        select attnum from pg_attribute
        where attrelid = rel.oid and attname = 'slug'
      )
  loop
    execute format('drop index if exists public.%I', r.index_name);
  end loop;
end;
$$;

create unique index if not exists colors_owner_slug_key on public.colors (owner_id, slug);

-- 4) Contador de SKU de cada pessoa.
create table if not exists public.user_sku_counters (
  owner_id uuid primary key,
  last_sku bigint not null,
  updated_at timestamptz not null default now()
);

-- Pega o próximo SKU da pessoa (soma 1 no contador dela).
-- Devolve null se a pessoa ainda não tem contador.
create or replace function public.next_sku_for_owner(p_owner uuid)
returns bigint
language sql
as $$
  update public.user_sku_counters
  set last_sku = last_sku + 1, updated_at = now()
  where owner_id = p_owner
  returning last_sku;
$$;

-- Cria o contador da pessoa começando em p_start (se ainda não existir).
create or replace function public.start_sku_counter(p_owner uuid, p_start bigint)
returns bigint
language plpgsql
as $$
declare
  v bigint;
begin
  insert into public.user_sku_counters (owner_id, last_sku)
  values (p_owner, p_start)
  on conflict (owner_id) do nothing
  returning last_sku into v;

  if v is null then
    -- Já existia (duas abas ao mesmo tempo): usa o próximo normalmente.
    v := public.next_sku_for_owner(p_owner);
  end if;

  return v;
end;
$$;

-- Depois de exportar: se a pessoa digitou um SKU maior que o contador,
-- o contador "pula" para ele, e o próximo será esse + 1.
create or replace function public.mark_sku_used(p_owner uuid, p_sku bigint)
returns void
language sql
as $$
  insert into public.user_sku_counters (owner_id, last_sku)
  values (p_owner, p_sku)
  on conflict (owner_id) do update
  set last_sku = greatest(public.user_sku_counters.last_sku, excluded.last_sku),
      updated_at = now();
$$;

-- Ninguém de fora acessa essas tabelas/funções direto; só o servidor do site.
alter table public.user_sku_counters enable row level security;
revoke all on function public.next_sku_for_owner(uuid) from public, anon, authenticated;
revoke all on function public.start_sku_counter(uuid, bigint) from public, anon, authenticated;
revoke all on function public.mark_sku_used(uuid, bigint) from public, anon, authenticated;
grant execute on function public.next_sku_for_owner(uuid) to service_role;
grant execute on function public.start_sku_counter(uuid, bigint) to service_role;
grant execute on function public.mark_sku_used(uuid, bigint) to service_role;

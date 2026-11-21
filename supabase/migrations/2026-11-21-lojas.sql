-- =====================================================================
-- LOJAS: cada loja tem o próprio Bling, as próprias cores e o próprio SKU.
-- Usuários são ligados às lojas (uma pessoa pode ter várias lojas,
-- e uma loja pode ter várias pessoas).
--
-- Nada é apagado. Os dados de hoje viram a "primeira loja" de cada pessoa:
-- a loja recebe o MESMO código (id) da pessoa, então as cores, o contador
-- de SKU e a conexão com o Bling que já existem continuam ligados.
--
-- Pode rodar mais de uma vez sem problema.
-- Rode no Supabase: SQL Editor → New query → cole tudo → Run.
-- =====================================================================

-- 1) Lojas e quem tem acesso a cada uma.
create table if not exists public.stores (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.store_members (
  store_id uuid not null references public.stores (id) on delete cascade,
  user_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (store_id, user_id)
);

create index if not exists store_members_user_idx on public.store_members (user_id);

-- 2) Uma loja para cada pessoa que já tem cores, SKU ou Bling conectado.
insert into public.stores (id, name)
select u.id,
       coalesce(nullif(u.raw_user_meta_data ->> 'name', ''), split_part(u.email, '@', 1))
from auth.users u
where u.id in (
  select owner_id from public.colors where owner_id is not null
  union select owner_id from public.user_sku_counters
  union select owner_id from public.bling_connections
)
on conflict (id) do nothing;

insert into public.store_members (store_id, user_id)
select s.id, s.id
from public.stores s
join auth.users u on u.id = s.id
on conflict do nothing;

-- 3) As cores passam a ser da loja (owner_id continua guardando quem criou).
alter table public.colors add column if not exists store_id uuid;

update public.colors
set store_id = owner_id
where store_id is null and owner_id is not null;

create index if not exists colors_store_id_idx on public.colors (store_id);
create unique index if not exists colors_store_slug_key on public.colors (store_id, slug);
drop index if exists public.colors_owner_slug_key;

-- 4) O contador de SKU (user_sku_counters) e a conexão com o Bling
--    (bling_connections) passam a usar o código da LOJA na coluna owner_id.
--    Como a primeira loja de cada pessoa tem o mesmo código dela,
--    nada precisa ser copiado.

-- Ninguém de fora acessa essas tabelas; só o servidor do site.
alter table public.stores enable row level security;
alter table public.store_members enable row level security;
revoke all on table public.stores from anon, authenticated;
revoke all on table public.store_members from anon, authenticated;

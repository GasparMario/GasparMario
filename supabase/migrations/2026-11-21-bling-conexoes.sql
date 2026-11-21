-- =====================================================================
-- Guarda a conexão de cada usuário com o Bling dele.
-- Pode rodar mais de uma vez sem problema.
-- Rode no Supabase: SQL Editor → New query → cole tudo → Run.
-- =====================================================================

create table if not exists public.bling_connections (
  owner_id uuid primary key,
  access_token text not null,
  refresh_token text not null,
  expires_at timestamptz not null,
  connected_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Ninguém de fora lê essa tabela; só o servidor do site (chave secreta).
alter table public.bling_connections enable row level security;
revoke all on table public.bling_connections from anon, authenticated;

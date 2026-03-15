-- Extensão para UUID
create extension if not exists "pgcrypto";

-- Tabela principal do dtf-manager
create table if not exists public.artes_dtf (
  id uuid primary key default gen_random_uuid(),
  nome_arte text not null,
  nome_normalizado text not null,
  tags text,
  storage_path text not null,
  public_url text not null,
  created_at timestamptz not null default now()
);

create index if not exists artes_dtf_nome_normalizado_idx
  on public.artes_dtf (nome_normalizado);

create index if not exists artes_dtf_created_at_idx
  on public.artes_dtf (created_at desc);

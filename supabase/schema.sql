-- Extensão para UUID
create extension if not exists "pgcrypto";

-- Tabela principal do dtf-manager
create table if not exists public.artes_dtf (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  nome_normalizado text not null,
  tags text,
  arquivo_path text not null,
  arquivo_nome_original text not null,
  tamanho_bytes bigint not null,
  created_at timestamptz not null default now()
);

-- Migração defensiva para bases existentes
alter table public.artes_dtf add column if not exists nome text;
alter table public.artes_dtf add column if not exists arquivo_path text;
alter table public.artes_dtf add column if not exists arquivo_nome_original text;
alter table public.artes_dtf add column if not exists tamanho_bytes bigint;

-- Se a base antiga tinha nome_arte, copia para nome quando vazio
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'artes_dtf'
      AND column_name = 'nome_arte'
  ) THEN
    EXECUTE 'update public.artes_dtf set nome = coalesce(nome, nome_arte) where nome is null';
  END IF;
END;
$$;

create index if not exists artes_dtf_nome_normalizado_idx
  on public.artes_dtf (nome_normalizado);

create index if not exists artes_dtf_created_at_idx
  on public.artes_dtf (created_at desc);

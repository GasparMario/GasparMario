# dtf-manager

Sistema web em **Next.js + TypeScript + Supabase** para upload, busca e download de PDFs de estampas DTF.

## O que mudou para suportar PDFs grandes

O upload agora é **direto do navegador para o Supabase Storage**. Assim, o arquivo PDF **não passa pela API Route do Next/Vercel**, evitando erro de limite de payload e falhas como `Unexpected token 'R'` em respostas não-JSON.

Fluxo atual:
1. Frontend envia o PDF direto ao bucket `dtf-pdfs`.
2. Após upload concluído, frontend chama `POST /api/dtf/artes` apenas com metadados.
3. A listagem busca no banco e gera **URL assinada** de download (válida por 1 hora).

## Funcionalidades do MVP

- Upload de PDF com nome da arte e tags.
- Persistência de metadados na tabela `artes_dtf`.
- Busca por nome parcial com normalização (`nome_normalizado`) ignorando maiúsculas/minúsculas e acentuação.
- Listagem ordenada pelos mais recentes primeiro.
- Download do PDF por item.
- Tratamento básico de erros na API e na interface.

## Pré-requisitos

- Node.js 20+
- Projeto Supabase criado

## 1) Instalação

```bash
npm install
```

## 2) Variáveis de ambiente

Crie um arquivo `.env.local` com:

```bash
# Server-side (API/listagem)
SUPABASE_URL=https://<project-ref>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
SUPABASE_DTF_BUCKET=dtf-pdfs

# Client-side (upload direto no browser)
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-key>
NEXT_PUBLIC_SUPABASE_DTF_BUCKET=dtf-pdfs
```

> Se `NEXT_PUBLIC_SUPABASE_DTF_BUCKET` não for informado, o sistema usa `dtf-pdfs`.

## 3) SQL da tabela

Execute o SQL abaixo no Supabase SQL Editor (também disponível em `supabase/schema.sql`):

```sql
create extension if not exists "pgcrypto";

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

create index if not exists artes_dtf_nome_normalizado_idx
  on public.artes_dtf (nome_normalizado);

create index if not exists artes_dtf_created_at_idx
  on public.artes_dtf (created_at desc);
```

## 4) Bucket e políticas do Storage

No Supabase Studio:

1. Vá em **Storage**.
2. Crie o bucket `dtf-pdfs` (pode ser privado).
3. Crie policy para permitir upload com chave anon (upload direto do browser):

```sql
create policy "Allow uploads to dtf-pdfs"
on storage.objects
for insert
to anon
with check (bucket_id = 'dtf-pdfs');
```

> Ajuste políticas conforme seu modelo de autenticação (recomendado para produção).

Se o bucket for privado, o download continua funcionando porque o backend gera URL assinada.


## 5) Rodar o projeto

```bash
npm run dev
```

Acesse:

- `http://localhost:3000/` → busca/listagem/download
- `http://localhost:3000/upload` → upload de novas artes

## Estrutura principal

- `app/page.tsx`: tela principal com busca e listagem.
- `app/upload/page.tsx`: tela de upload.
- `app/api/dtf/artes/route.ts`: API para listar e salvar metadados das artes.
- `components/`: componentes de UI.
- `lib/dtf.ts`: utilitários (normalização, validação e parsing de erros).
- `lib/dtf-repository.ts`: consulta de artes com filtro, ordenação e URL de download.
- `lib/supabase-browser.ts`: cliente Supabase para upload direto no browser.
- `supabase/schema.sql`: SQL da tabela.

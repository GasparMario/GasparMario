# dtf-manager

Sistema web em **Next.js + TypeScript + Supabase** para upload, busca e download de PDFs de estampas DTF.

## Funcionalidades do MVP

- Upload de arquivo PDF com nome da arte e tags.
- Validação para aceitar apenas PDF.
- Armazenamento de arquivos no **Supabase Storage** (bucket `dtf-pdfs`).
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
SUPABASE_URL=https://<project-ref>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
SUPABASE_DTF_BUCKET=dtf-pdfs
```

> `SUPABASE_DTF_BUCKET` é opcional; por padrão o sistema usa `dtf-pdfs`.

## 3) SQL da tabela

Execute o SQL abaixo no Supabase SQL Editor (também disponível em `supabase/schema.sql`):

```sql
create extension if not exists "pgcrypto";

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
```

## 4) Criar bucket de storage

No Supabase Studio:

1. Vá em **Storage**.
2. Crie o bucket `dtf-pdfs`.
3. Defina como público se quiser download direto por URL pública.

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
- `app/api/dtf/artes/route.ts`: API para listar e cadastrar artes.
- `components/`: componentes de UI.
- `lib/dtf.ts`: utilitários, incluindo normalização de nome.
- `lib/dtf-repository.ts`: consulta de artes com filtros e ordenação.
- `supabase/schema.sql`: SQL da tabela.

## Observações

- O projeto foi estilizado com CSS global organizado para layout profissional simples.
- Se quiser usar Tailwind CSS, basta instalar as dependências e migrar as classes para utilitários Tailwind.

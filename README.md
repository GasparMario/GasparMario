# GasparMario (Next.js + Supabase)

Admin de importação WooCommerce com:

- CRUD de cores via UI (`/admin`);
- upload de imagem por cor no Supabase Storage (`product-colors`);
- export CSV com coluna `Images` preenchida para produto pai e variações.

## Variáveis de ambiente

Crie `.env.local`:

```bash
SUPABASE_URL=https://<project-ref>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
SUPABASE_STORAGE_BUCKET=product-colors
```

> Bucket padrão: `product-colors` (público).

## Estrutura Supabase esperada

Tabela `colors`:

- `id` (uuid, pk)
- `name` (text, not null)
- `slug` (text, unique, not null)
- `image_url` (text, null)

## Upload de imagem (regra implementada)

- Se a cor tiver slug, o arquivo é salvo usando slug no caminho/nome.
- Padrão do path:

```text
colors/{slug}/{slug}-{timestamp}-{rand}.{ext}
```

- `upsert: false` (não sobrescreve).
- É permitido subir várias imagens para a mesma cor; `colors.image_url` passa a apontar para a URL pública mais recente.

## Rodar local

```bash
npm install
npm run dev
```

Acesse: `http://localhost:3000/admin`

## Regras de export implementadas

- Variações (cor+tamanho): `Images` = `colors.image_url` da cor.
- Produto pai: `Images` = lista única das `image_url` das cores selecionadas, separadas por vírgula.
- Cor sem `image_url`: `Images` vazio nas variações dessa cor (sem falhar export).

## Geração de SKU (`/api/sku/next`)

A rota `GET /api/sku/next` usa RPC `next_sku` no Supabase e foi marcada como **dinâmica** (`force-dynamic`) com `Cache-Control: no-store` para evitar cache de resposta em produção (ex.: Vercel).

Se local funciona e no Vercel não, normalmente é um destes pontos:

- cache indevido em rota `GET` (retornando o mesmo SKU);
- variáveis `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` ausentes no projeto da Vercel;
- função RPC `next_sku` não criada/publicada no banco de produção.

Exemplo de função SQL (atômica) para o Supabase:

```sql
create sequence if not exists public.sku_seq start 1;

create or replace function public.next_sku()
returns bigint
language sql
security definer
as $$
  select nextval('public.sku_seq');
$$;
```

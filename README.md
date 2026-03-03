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

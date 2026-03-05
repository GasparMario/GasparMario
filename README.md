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
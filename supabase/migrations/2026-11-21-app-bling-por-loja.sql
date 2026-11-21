-- =====================================================================
-- Cada loja pode ter o PRÓPRIO aplicativo do Bling (Client ID e Secret),
-- criado dentro do Bling dela. Sem isso, a loja usa o app da MG
-- (as chaves cadastradas na Vercel), que só funciona na conta da MG.
-- Pode rodar mais de uma vez sem problema.
-- =====================================================================

alter table public.stores add column if not exists bling_client_id text;
alter table public.stores add column if not exists bling_client_secret text;

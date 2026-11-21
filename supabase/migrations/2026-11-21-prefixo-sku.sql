-- =====================================================================
-- Prefixo do SKU por loja (opcional). Ex: RES -> SKUs RES100246, RES10024601...
-- Lojas sem prefixo continuam com SKU só de números.
-- Pode rodar mais de uma vez sem problema.
-- =====================================================================

alter table public.stores add column if not exists sku_prefix text;

-- Duas lojas não podem ter o mesmo prefixo.
create unique index if not exists stores_sku_prefix_key
  on public.stores (upper(sku_prefix))
  where sku_prefix is not null;

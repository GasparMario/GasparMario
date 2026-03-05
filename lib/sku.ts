export type NextSkuRpcResponse = number | string | { next_sku?: number | string } | null;

export function normalizeNumericSku(raw: number | string) {
  const value = String(raw).trim();
  if (!value) return null;
  if (!/^\d+$/.test(value)) return null;
  return value;
}

export function extractNextSkuRpcValue(data: NextSkuRpcResponse) {
  if (data == null) return null;
  if (typeof data === "object") {
    return data.next_sku ?? null;
  }
  return data;
}

export type ExportVariation<TColor> = {
  color: TColor;
  size: string;
};

export function buildOrderedVariations<TColor extends { slug: string }>(colors: TColor[], sizes: string[]) {
  return colors
    .flatMap((color) => sizes.map((size) => ({ color, size })))
    .sort((a, b) => `${a.color.slug}::${a.size}`.localeCompare(`${b.color.slug}::${b.size}`));
}

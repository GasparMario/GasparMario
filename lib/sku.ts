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

// ===== Prefixo do SKU por loja =====
// SKU do pai = PREFIXO (opcional, 2 a 5 letras) + número. Ex: RES100246.
export const SKU_PATTERN = /^[A-Z]{0,5}\d+$/;

export function normalizeSkuInput(value: string): string {
  return value.trim().toUpperCase().replace(/\s+/g, "");
}

export function isValidParentSku(value: string): boolean {
  return SKU_PATTERN.test(normalizeSkuInput(value));
}

// Separa "RES100246" em { prefix: "RES", number: "100246" }.
export function splitSku(value: string): { prefix: string; number: string } | null {
  const match = /^([A-Z]{0,5})(\d+)$/.exec(normalizeSkuInput(value));
  if (!match) return null;
  return { prefix: match[1], number: match[2] };
}

export function normalizePrefix(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/[^A-Z]/g, "");
}

export function isValidPrefix(value: string): boolean {
  return /^[A-Z]{2,5}$/.test(value);
}

// Sugestão: 3 primeiras letras do nome da loja (Restricted -> RES).
export function suggestPrefix(storeName: string): string {
  return normalizePrefix(storeName).slice(0, 3);
}

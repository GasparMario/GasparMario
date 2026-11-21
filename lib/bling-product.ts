// Monta o produto no formato da API v3 do Bling, espelhando o que o CSV
// de importação já cria hoje (mesmos SKUs, nomes de variação, preço, peso e fotos).

import { buildOrderedVariations } from "@/lib/sku";

export type ProductColor = { id: string; name: string; slug: string; image_url: string | null };

export type ProductInput = {
  name: string;
  skuBase: string;
  price: number;
  weight: number | null;
  sizes: string[];
  colors: ProductColor[];
};

function images(...urls: (string | null | undefined)[]) {
  const links = urls.filter((u): u is string => Boolean(u)).map((link) => ({ link }));
  return links.length ? { imagens: { imagensURL: links } } : undefined;
}

// Bling usa ":" e ";" para separar atributo e valor no nome da variação.
function clean(value: string) {
  return value.replace(/[:;]/g, " ").replace(/\s+/g, " ").trim();
}

export function buildBlingProduct(input: ProductInput) {
  const orderedColors = [...input.colors].sort((a, b) => a.slug.localeCompare(b.slug));
  const variations = buildOrderedVariations(orderedColors, input.sizes);
  const weight = input.weight ?? undefined;

  const common = {
    tipo: "P",
    situacao: "A",
    unidade: "UN",
    preco: input.price,
    tipoProducao: "P",
    ...(weight !== undefined ? { pesoLiquido: weight, pesoBruto: weight } : {}),
    tributacao: { origem: 0 }
  };

  return {
    nome: input.name,
    codigo: input.skuBase,
    formato: "V",
    ...common,
    midia: images(orderedColors.find((c) => c.image_url)?.image_url),
    variacoes: variations.map(({ color, size }, index) => {
      const variacaoNome = `Cor:${clean(color.name)};Tamanho:${clean(size)}`;
      return {
        nome: `${input.name} ${variacaoNome}`,
        codigo: `${input.skuBase}${String(index + 1).padStart(2, "0")}`,
        formato: "S",
        ...common,
        midia: images(color.image_url),
        variacao: {
          nome: variacaoNome,
          ordem: index + 1,
          produtoPai: { cloneInfo: false }
        }
      };
    })
  };
}

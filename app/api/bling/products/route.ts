import { NextRequest, NextResponse } from "next/server";
import { getStoreContext } from "@/lib/stores";
import { BlingError, blingRequest } from "@/lib/bling";
import { buildBlingProduct, type ProductColor } from "@/lib/bling-product";
import { getSupabaseServerClient } from "@/lib/supabase-server";
import { isValidParentSku, normalizeSkuInput } from "@/lib/sku";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = {
  name?: string;
  skuBase?: string;
  price?: string;
  weight?: string;
  sizes?: string[];
  colorIds?: string[];
};

function toNumber(value: string | undefined): number | null {
  const text = String(value ?? "").trim().replace(/\s+/g, "").replace(",", ".");
  if (!text) return null;
  const n = Number(text);
  return Number.isFinite(n) && n >= 0 ? n : NaN;
}

function fail(message: string, status = 400, details: string[] = []) {
  return NextResponse.json({ error: message, details }, { status });
}

// Cria o produto (pai + variações) direto no Bling de quem está logado.
export async function POST(request: NextRequest) {
  try {
    // Envia para o Bling da loja ativa, usando as cores dessa loja.
    const { ctx, response } = await getStoreContext();
    if (response) return response;
    const ownerId = ctx.store.id;

    const body = (await request.json()) as Body;
    const name = (body.name || "").trim();
    const skuBase = normalizeSkuInput(body.skuBase || "");
    const sizes = (body.sizes || []).map((s) => String(s).trim()).filter(Boolean);
    const colorIds = Array.from(new Set(body.colorIds || []));
    const price = toNumber(body.price);
    const weight = toNumber(body.weight);

    if (!name) return fail("Informe o nome do produto.");
    if (!isValidParentSku(skuBase)) {
      return fail("SKU do pai inválido. Use só números, com até 5 letras na frente (ex: 100001 ou RES100001).");
    }
    if (sizes.length === 0) return fail("Informe pelo menos um tamanho.");
    if (colorIds.length === 0) return fail("Selecione pelo menos uma cor.");
    if (price === null || Number.isNaN(price)) return fail("Informe um preço válido (ex: 79,90).");
    if (Number.isNaN(weight)) return fail("Informe um peso válido (ex: 0,25).");

    // Só as cores da própria pessoa.
    const { data: colors, error } = await getSupabaseServerClient()
      .from("colors")
      .select("id,name,slug,image_url")
      .eq("store_id", ownerId)
      .in("id", colorIds);

    if (error) return fail(error.message, 500);
    if (!colors || colors.length !== colorIds.length) {
      return fail("Alguma cor selecionada não foi encontrada. Atualize a página e tente de novo.");
    }

    // Não sobrescreve: se o SKU já existe no Bling, avisa.
    const existing = await blingRequest<{ data?: { id: number; codigo?: string }[] }>(
      ownerId,
      `/produtos?${new URLSearchParams({ codigo: skuBase }).toString()}`
    );
    const duplicate = (existing.data || []).find((p) => String(p.codigo) === skuBase);
    if (duplicate) {
      return fail(
        `Já existe um produto com o SKU ${skuBase} no seu Bling. Use outro SKU (clique em "Gerar próximo") para não sobrescrever.`,
        409
      );
    }

    const product = buildBlingProduct({
      name,
      skuBase,
      price,
      weight,
      sizes,
      colors: colors as ProductColor[]
    });

    const created = await blingRequest<{ data?: { id?: number } }>(ownerId, "/produtos", {
      method: "POST",
      body: product
    });

    return NextResponse.json({
      ok: true,
      id: created.data?.id ?? null,
      variations: product.variacoes.length
    });
  } catch (err) {
    if (err instanceof BlingError) {
      return fail(err.message, err.status >= 400 && err.status < 600 ? err.status : 500, err.details);
    }
    return fail(err instanceof Error ? err.message : "Erro ao enviar para o Bling.", 500);
  }
}

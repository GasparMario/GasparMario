import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase-server";
import { DEFAULT_START_SKU, isFirstAppUser } from "@/lib/auth-users";
import { getStoreContext } from "@/lib/stores";
import { extractNextSkuRpcValue, normalizeNumericSku, type NextSkuRpcResponse } from "@/lib/sku";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const NO_STORE = { "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate" };

function fail(message: string, details?: string, status = 500) {
  return NextResponse.json({ error: message, details }, { status, headers: NO_STORE });
}

// Cada LOJA tem o seu próprio contador de SKU (tabela user_sku_counters,
// coluna owner_id = código da loja).
// - Já tem contador: soma 1 e devolve.
// - Loja do primeiro usuário (Mario) sem contador: continua de onde o
//   contador antigo (função next_sku do Supabase) parou.
// - Outras lojas sem contador: começa em 100001 (o administrador ajusta
//   o próximo SKU de cada loja na página Lojas).
export async function GET() {
  try {
    const { ctx, response } = await getStoreContext();
    if (response) return response;
    const ownerId = ctx.store.id;

    const supabase = getSupabaseServerClient();

    const { data: next, error: nextError } = await supabase.rpc("next_sku_for_owner", {
      p_owner: ownerId
    });

    if (nextError) {
      return fail("Falha ao gerar SKU via Supabase RPC `next_sku_for_owner`.", nextError.message);
    }

    if (next != null) {
      const sku = normalizeNumericSku(next as number | string);
      if (!sku) return fail("O contador de SKU devolveu um valor inválido.");
      return NextResponse.json({ sku }, { headers: NO_STORE });
    }

    let seed: string | null = String(DEFAULT_START_SKU);

    if (await isFirstAppUser(ownerId)) {
      // Primeiro usuário: continua de onde o contador antigo parou.
      const { data: legacy, error: legacyError } = await supabase.rpc("next_sku");
      if (legacyError) {
        return fail("Falha ao gerar SKU via Supabase RPC `next_sku`.", legacyError.message);
      }
      const legacyRaw = extractNextSkuRpcValue(legacy as NextSkuRpcResponse);
      seed = (legacyRaw == null ? null : normalizeNumericSku(legacyRaw)) || seed;
    }

    const { data: started, error: startError } = await supabase.rpc("start_sku_counter", {
      p_owner: ownerId,
      p_start: Number(seed)
    });

    if (startError) {
      return fail("Falha ao iniciar o contador de SKU.", startError.message);
    }

    const sku = normalizeNumericSku(started as number | string);
    if (!sku) return fail("O contador de SKU devolveu um valor inválido.");
    return NextResponse.json({ sku }, { headers: NO_STORE });
  } catch (err) {
    return fail("Erro interno ao gerar SKU.", err instanceof Error ? err.message : "Erro desconhecido");
  }
}

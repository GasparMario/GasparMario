import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase-server";
import { getCurrentUserId, isFirstAppUser } from "@/lib/auth-users";
import { extractNextSkuRpcValue, normalizeNumericSku, type NextSkuRpcResponse } from "@/lib/sku";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const NO_STORE = { "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate" };

function fail(message: string, details?: string, status = 500) {
  return NextResponse.json({ error: message, details }, { status, headers: NO_STORE });
}

// Cada pessoa tem o seu próprio contador de SKU (tabela sku_counters).
// - Já tem contador: soma 1 e devolve.
// - Primeiro usuário (Mario) sem contador: continua de onde o contador antigo
//   (função next_sku do Supabase) parou.
// - Outras pessoas sem contador: devolve sku = null, para a tela pedir
//   o SKU inicial. Depois do primeiro export, o contador começa dali.
export async function GET() {
  try {
    const ownerId = await getCurrentUserId();
    if (!ownerId) return fail("Não autorizado.", undefined, 401);

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

    if (!(await isFirstAppUser(ownerId))) {
      return NextResponse.json({ sku: null, needsFirstSku: true }, { headers: NO_STORE });
    }

    // Primeiro usuário: semeia o contador com o contador antigo.
    const { data: legacy, error: legacyError } = await supabase.rpc("next_sku");
    if (legacyError) {
      return fail("Falha ao gerar SKU via Supabase RPC `next_sku`.", legacyError.message);
    }

    const legacyRaw = extractNextSkuRpcValue(legacy as NextSkuRpcResponse);
    const seed = legacyRaw == null ? null : normalizeNumericSku(legacyRaw);
    if (!seed) {
      return NextResponse.json({ sku: null, needsFirstSku: true }, { headers: NO_STORE });
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

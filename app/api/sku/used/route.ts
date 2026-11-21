import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase-server";
import { getStoreContext } from "@/lib/stores";
import { splitSku } from "@/lib/sku";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Chamado depois de exportar: avisa que esse SKU foi usado.
// Se for maior que o contador da pessoa, o contador pula para ele.
export async function POST(request: NextRequest) {
  try {
    const { ctx, response } = await getStoreContext();
    if (response) return response;
    const ownerId = ctx.store.id;

    const body = (await request.json()) as { sku?: string | number };
    const sku = body.sku == null ? null : splitSku(String(body.sku))?.number ?? null;

    if (!sku || !Number.isSafeInteger(Number(sku))) {
      return NextResponse.json({ error: "SKU inválido." }, { status: 400 });
    }

    const supabase = getSupabaseServerClient();
    const { error } = await supabase.rpc("mark_sku_used", {
      p_owner: ownerId,
      p_sku: Number(sku)
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Erro ao registrar SKU." },
      { status: 500 }
    );
  }
}

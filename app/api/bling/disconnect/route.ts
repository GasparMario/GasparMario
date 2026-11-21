import { NextRequest, NextResponse } from "next/server";
import { disconnect } from "@/lib/bling";
import { requireAdmin } from "@/lib/require-admin";
import { listAllStores } from "@/lib/stores";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Desconecta o Bling de uma loja. Só administradores.
export async function POST(request: NextRequest) {
  const { response } = await requireAdmin();
  if (response) return response;

  try {
    const body = (await request.json().catch(() => ({}))) as { storeId?: string };
    const stores = await listAllStores();
    if (!body.storeId || !stores.some((s) => s.id === body.storeId)) {
      return NextResponse.json({ error: "Loja não encontrada." }, { status: 404 });
    }
    await disconnect(body.storeId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Erro ao desconectar." },
      { status: 500 }
    );
  }
}

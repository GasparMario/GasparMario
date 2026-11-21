import { NextResponse } from "next/server";
import { getConnection, isBlingConfigured } from "@/lib/bling";
import { getStoreContext } from "@/lib/stores";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Situação do Bling da LOJA ativa.
export async function GET() {
  const { ctx, response } = await getStoreContext();
  if (response) return response;

  const base = { storeId: ctx.store.id, storeName: ctx.store.name, isAdmin: ctx.user.isAdmin };

  if (!isBlingConfigured()) {
    return NextResponse.json({ ...base, configured: false, connected: false });
  }

  try {
    const conn = await getConnection(ctx.store.id);
    return NextResponse.json({
      ...base,
      configured: true,
      connected: Boolean(conn),
      connectedAt: conn?.connected_at ?? null
    });
  } catch (err) {
    return NextResponse.json(
      { ...base, configured: true, connected: false, error: err instanceof Error ? err.message : "Erro" },
      { status: 500 }
    );
  }
}

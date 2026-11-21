import { NextResponse } from "next/server";
import { getStoreContext } from "@/lib/stores";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Lojas que a pessoa pode usar + a loja ativa.
export async function GET() {
  const { ctx, response } = await getStoreContext();
  if (response) return response;
  return NextResponse.json({
    stores: ctx.stores,
    activeId: ctx.store.id,
    isAdmin: ctx.user.isAdmin
  });
}

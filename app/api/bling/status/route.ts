import { NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/auth-users";
import { getConnection, isBlingConfigured } from "@/lib/bling";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const uid = await getCurrentUserId();
  if (!uid) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  if (!isBlingConfigured()) {
    return NextResponse.json({ configured: false, connected: false });
  }

  try {
    const conn = await getConnection(uid);
    return NextResponse.json({
      configured: true,
      connected: Boolean(conn),
      connectedAt: conn?.connected_at ?? null
    });
  } catch (err) {
    return NextResponse.json(
      { configured: true, connected: false, error: err instanceof Error ? err.message : "Erro" },
      { status: 500 }
    );
  }
}

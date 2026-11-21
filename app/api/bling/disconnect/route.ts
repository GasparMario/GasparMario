import { NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/auth-users";
import { disconnect } from "@/lib/bling";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  const uid = await getCurrentUserId();
  if (!uid) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  try {
    await disconnect(uid);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Erro ao desconectar." },
      { status: 500 }
    );
  }
}

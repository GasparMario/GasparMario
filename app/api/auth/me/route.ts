import { NextResponse } from "next/server";
import { getCurrentAppUser } from "@/lib/auth-users";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await getCurrentAppUser();
    if (!user) {
      return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
    }
    return NextResponse.json({
      uid: user.id,
      email: user.email,
      name: user.name,
      isAdmin: user.isAdmin
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Erro ao ler usuário." },
      { status: 500 }
    );
  }
}

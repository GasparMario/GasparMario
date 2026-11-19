import { NextResponse } from "next/server";
import { deleteAppUser, getCurrentSession, listAppUsers } from "@/lib/auth-users";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getCurrentSession();

    if (session?.uid === params.id) {
      return NextResponse.json(
        { error: "Você não pode remover o seu próprio acesso." },
        { status: 400 }
      );
    }

    const users = await listAppUsers();
    if (users.length <= 1) {
      return NextResponse.json(
        { error: "Precisa sobrar pelo menos um usuário." },
        { status: 400 }
      );
    }

    await deleteAppUser(params.id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Erro ao remover usuário." },
      { status: 400 }
    );
  }
}

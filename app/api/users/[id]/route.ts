import { NextRequest, NextResponse } from "next/server";
import { deleteAppUser, listAppUsers, setUserAdmin } from "@/lib/auth-users";
import { removeUserFromAllStores } from "@/lib/stores";
import { requireAdmin } from "@/lib/require-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Alterar um usuário: tornar/tirar administrador.
// (Lojas de cada pessoa e próximo SKU ficam na página Lojas.)
export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { admin, response } = await requireAdmin();
    if (response) return response;

    const body = (await request.json()) as { isAdmin?: boolean };
    const users = await listAppUsers();
    const target = users.find((u) => u.id === params.id);

    if (!target) {
      return NextResponse.json({ error: "Usuário não encontrado." }, { status: 404 });
    }

    if (typeof body.isAdmin === "boolean") {
      if (target.id === admin.id) {
        return NextResponse.json(
          { error: "Você não pode mudar o seu próprio acesso de administrador." },
          { status: 400 }
        );
      }
      if (target.isOwner && !body.isAdmin) {
        return NextResponse.json(
          { error: "O dono do sistema é sempre administrador." },
          { status: 400 }
        );
      }
      await setUserAdmin(target.id, body.isAdmin);
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Erro ao alterar usuário." },
      { status: 400 }
    );
  }
}

export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  try {
    const { admin, response } = await requireAdmin();
    if (response) return response;

    if (admin.id === params.id) {
      return NextResponse.json(
        { error: "Você não pode remover o seu próprio acesso." },
        { status: 400 }
      );
    }

    const users = await listAppUsers();
    const target = users.find((u) => u.id === params.id);
    if (target?.isOwner) {
      return NextResponse.json(
        { error: "O dono do sistema não pode ser removido." },
        { status: 400 }
      );
    }

    await deleteAppUser(params.id);
    await removeUserFromAllStores(params.id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Erro ao remover usuário." },
      { status: 400 }
    );
  }
}

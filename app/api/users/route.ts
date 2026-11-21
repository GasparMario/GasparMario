import { NextRequest, NextResponse } from "next/server";
import { createAppUser, listAppUsers, validateEmail, validatePassword } from "@/lib/auth-users";
import { requireAdmin } from "@/lib/require-admin";
import { addUserToStore, getStoreMembers, listAllStores } from "@/lib/stores";

// Só administradores chegam aqui (checado em cada função).
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { response } = await requireAdmin();
    if (response) return response;

    const [users, stores, members] = await Promise.all([
      listAppUsers(),
      listAllStores(),
      getStoreMembers()
    ]);
    return NextResponse.json({
      users: users.map((u) => ({
        ...u,
        storeNames: stores
          .filter((s) => (members.get(s.id) ?? []).includes(u.id))
          .map((s) => s.name)
      })),
      stores
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Erro ao listar usuários." },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { response } = await requireAdmin();
    if (response) return response;

    const body = (await request.json()) as {
      email?: string;
      password?: string;
      name?: string;
      isAdmin?: boolean;
      storeIds?: string[];
    };
    const email = body.email || "";
    const password = body.password || "";

    const problem = validateEmail(email) || validatePassword(password);
    if (problem) {
      return NextResponse.json({ error: problem }, { status: 400 });
    }

    const user = await createAppUser({
      email,
      password,
      name: body.name,
      isAdmin: Boolean(body.isAdmin)
    });

    const validStores = new Set((await listAllStores()).map((s) => s.id));
    for (const storeId of body.storeIds ?? []) {
      if (validStores.has(storeId)) await addUserToStore(storeId, user.id);
    }

    return NextResponse.json({ user }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Erro ao criar usuário." },
      { status: 400 }
    );
  }
}

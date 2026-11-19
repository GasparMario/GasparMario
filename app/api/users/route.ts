import { NextRequest, NextResponse } from "next/server";
import {
  DEFAULT_START_SKU,
  createAppUser,
  listAppUsers,
  parseSku,
  setNextSku,
  validateEmail,
  validatePassword
} from "@/lib/auth-users";
import { requireAdmin } from "@/lib/require-admin";

// Só administradores chegam aqui (checado em cada função).
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { response } = await requireAdmin();
    if (response) return response;

    return NextResponse.json({ users: await listAppUsers({ withSku: true }) });
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
      startSku?: string | number;
    };
    const email = body.email || "";
    const password = body.password || "";

    const problem = validateEmail(email) || validatePassword(password);
    if (problem) {
      return NextResponse.json({ error: problem }, { status: 400 });
    }

    const hasStartSku = body.startSku != null && String(body.startSku).trim() !== "";
    const startSku = hasStartSku ? parseSku(body.startSku) : DEFAULT_START_SKU;
    if (!startSku) {
      return NextResponse.json(
        { error: "O SKU inicial precisa ser só números (ex: 100001)." },
        { status: 400 }
      );
    }

    const user = await createAppUser({
      email,
      password,
      name: body.name,
      isAdmin: Boolean(body.isAdmin)
    });

    await setNextSku(user.id, startSku);

    return NextResponse.json({ user }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Erro ao criar usuário." },
      { status: 400 }
    );
  }
}

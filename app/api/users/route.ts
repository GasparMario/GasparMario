import { NextRequest, NextResponse } from "next/server";
import {
  createAppUser,
  listAppUsers,
  validateEmail,
  validatePassword
} from "@/lib/auth-users";

// O middleware já garante que só quem está logado chega aqui.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json({ users: await listAppUsers() });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Erro ao listar usuários." },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { email?: string; password?: string; name?: string };
    const email = body.email || "";
    const password = body.password || "";

    const problem = validateEmail(email) || validatePassword(password);
    if (problem) {
      return NextResponse.json({ error: problem }, { status: 400 });
    }

    const user = await createAppUser({ email, password, name: body.name });
    return NextResponse.json({ user }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Erro ao criar usuário." },
      { status: 400 }
    );
  }
}

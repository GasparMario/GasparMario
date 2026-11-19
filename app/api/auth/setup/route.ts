import { NextRequest, NextResponse } from "next/server";
import {
  createAppUser,
  listAppUsers,
  validateEmail,
  validatePassword
} from "@/lib/auth-users";
import { SESSION_COOKIE, createSessionToken, sessionCookieOptions } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET: diz se ainda não existe nenhum usuário (primeiro acesso).
export async function GET() {
  try {
    const users = await listAppUsers();
    return NextResponse.json({ needsSetup: users.length === 0 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Erro ao verificar usuários." },
      { status: 500 }
    );
  }
}

// POST: cria o PRIMEIRO usuário. Só funciona enquanto não existir nenhum.
export async function POST(request: NextRequest) {
  try {
    const users = await listAppUsers();
    if (users.length > 0) {
      return NextResponse.json(
        { error: "O primeiro acesso já foi criado. Entre com seu e-mail e senha." },
        { status: 403 }
      );
    }

    const body = (await request.json()) as { email?: string; password?: string; name?: string };
    const email = body.email || "";
    const password = body.password || "";

    const problem = validateEmail(email) || validatePassword(password);
    if (problem) {
      return NextResponse.json({ error: problem }, { status: 400 });
    }

    const user = await createAppUser({ email, password, name: body.name });
    const token = await createSessionToken(user.id, user.email);
    const response = NextResponse.json({ ok: true });
    response.cookies.set(SESSION_COOKIE, token, sessionCookieOptions());
    return response;
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Erro ao criar o primeiro acesso." },
      { status: 400 }
    );
  }
}

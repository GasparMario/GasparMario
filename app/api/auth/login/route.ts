import { NextRequest, NextResponse } from "next/server";
import { getAuthAdminClient, isAppUser } from "@/lib/auth-users";
import { SESSION_COOKIE, createSessionToken, sessionCookieOptions } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const INVALID = "E-mail ou senha incorretos.";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { email?: string; password?: string };
    const email = (body.email || "").trim().toLowerCase();
    const password = body.password || "";

    if (!email || !password) {
      return NextResponse.json({ error: "Informe e-mail e senha." }, { status: 400 });
    }

    const supabase = getAuthAdminClient();
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error || !data.user || !isAppUser(data.user)) {
      return NextResponse.json({ error: INVALID }, { status: 401 });
    }

    const token = await createSessionToken(data.user.id, data.user.email || email);
    const response = NextResponse.json({ ok: true });
    response.cookies.set(SESSION_COOKIE, token, sessionCookieOptions());
    return response;
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Erro ao entrar." },
      { status: 500 }
    );
  }
}

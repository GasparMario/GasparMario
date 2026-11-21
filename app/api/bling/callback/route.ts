import { NextRequest, NextResponse } from "next/server";
import { getCurrentAppUser } from "@/lib/auth-users";
import { connectWithCode } from "@/lib/bling";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STATE_COOKIE = "bling_oauth_state";

// O Bling devolve a pessoa para cá depois que ela clica em "Autorizar".
// A conexão fica guardada na LOJA escolhida em /api/bling/connect.
export async function GET(request: NextRequest) {
  const [expected, storeId, backRaw] = (request.cookies.get(STATE_COOKIE)?.value || "").split("|");
  const back = backRaw === "/admin" ? "/admin" : "/lojas";

  const goBack = (status: string) => {
    const response = NextResponse.redirect(new URL(`${back}?bling=${status}`, request.url));
    response.cookies.set(STATE_COOKIE, "", { path: "/", maxAge: 0 });
    return response;
  };

  const user = await getCurrentAppUser();
  if (!user) return NextResponse.redirect(new URL("/login", request.url));
  if (!user.isAdmin) return goBack("so-admin");

  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");

  if (!code) return goBack("cancelado");
  if (!state || !expected || !storeId || state !== expected) return goBack("erro-state");

  try {
    await connectWithCode(storeId, code);
    return goBack("conectado");
  } catch (err) {
    console.error("[bling] callback:", err instanceof Error ? err.message : err);
    return goBack("erro");
  }
}

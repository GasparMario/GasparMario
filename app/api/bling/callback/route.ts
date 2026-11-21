import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/auth-users";
import { connectWithCode } from "@/lib/bling";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STATE_COOKIE = "bling_oauth_state";

// O Bling devolve a pessoa para cá depois que ela clica em "Autorizar".
export async function GET(request: NextRequest) {
  const back = (status: string) => {
    const response = NextResponse.redirect(new URL(`/admin?bling=${status}`, request.url));
    response.cookies.set(STATE_COOKIE, "", { path: "/", maxAge: 0 });
    return response;
  };

  const uid = await getCurrentUserId();
  if (!uid) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const expected = request.cookies.get(STATE_COOKIE)?.value;

  if (!code) return back("cancelado");
  if (!state || !expected || state !== expected) return back("erro-state");

  try {
    await connectWithCode(uid, code);
    return back("conectado");
  } catch (err) {
    console.error("[bling] callback:", err instanceof Error ? err.message : err);
    return back("erro");
  }
}

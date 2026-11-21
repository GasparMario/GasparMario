import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/auth-users";
import { buildAuthorizeUrl, isBlingConfigured } from "@/lib/bling";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STATE_COOKIE = "bling_oauth_state";

// Abre a tela de autorização do Bling.
// O "state" é um código aleatório guardado num cookie para conferir na volta
// (impede que alguém conecte o Bling de outra pessoa na sua conta).
export async function GET(request: NextRequest) {
  const uid = await getCurrentUserId();
  if (!uid) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (!isBlingConfigured()) {
    return NextResponse.redirect(new URL("/admin?bling=nao-configurado", request.url));
  }

  const random = crypto.getRandomValues(new Uint8Array(16));
  const state = Array.from(random, (b) => b.toString(16).padStart(2, "0")).join("");

  const response = NextResponse.redirect(buildAuthorizeUrl(state));
  response.cookies.set(STATE_COOKIE, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 10
  });
  return response;
}

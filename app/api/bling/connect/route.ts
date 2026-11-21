import { NextRequest, NextResponse } from "next/server";
import { getCurrentAppUser } from "@/lib/auth-users";
import { buildAuthorizeUrl, isBlingConfigured } from "@/lib/bling";
import { listAllStores } from "@/lib/stores";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STATE_COOKIE = "bling_oauth_state";

// Abre a tela de autorização do Bling para conectar o Bling de UMA LOJA.
// Só administradores. Uso: /api/bling/connect?store=<id da loja>&back=lojas|admin
// O "state" é um código aleatório guardado num cookie (junto com a loja)
// para conferir na volta.
export async function GET(request: NextRequest) {
  const back = request.nextUrl.searchParams.get("back") === "admin" ? "/admin" : "/lojas";
  const goBack = (status: string) =>
    NextResponse.redirect(new URL(`${back}?bling=${status}`, request.url));

  const user = await getCurrentAppUser();
  if (!user) return NextResponse.redirect(new URL("/login", request.url));
  if (!user.isAdmin) return goBack("so-admin");
  if (!isBlingConfigured()) return goBack("nao-configurado");

  const storeId = request.nextUrl.searchParams.get("store") || "";
  const stores = await listAllStores();
  if (!stores.some((s) => s.id === storeId)) return goBack("loja-invalida");

  const random = crypto.getRandomValues(new Uint8Array(16));
  const state = Array.from(random, (b) => b.toString(16).padStart(2, "0")).join("");

  const response = NextResponse.redirect(buildAuthorizeUrl(state));
  response.cookies.set(STATE_COOKIE, `${state}|${storeId}|${back}`, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 10
  });
  return response;
}

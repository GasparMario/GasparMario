import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, readSessionToken } from "@/lib/session";

// Endereços que podem ser abertos sem estar logado.
const PUBLIC_PATHS = ["/login", "/api/auth/login", "/api/auth/setup"];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (PUBLIC_PATHS.includes(pathname)) {
    return NextResponse.next();
  }

  const session = await readSessionToken(request.cookies.get(SESSION_COOKIE)?.value);

  if (session) {
    return NextResponse.next();
  }

  // Funções internas (API): responde "não autorizado".
  if (pathname.startsWith("/api/")) {
    return NextResponse.json(
      { error: "Sua sessão expirou. Entre de novo para continuar." },
      { status: 401 }
    );
  }

  // Telas: manda para o login.
  const loginUrl = request.nextUrl.clone();
  loginUrl.pathname = "/login";
  loginUrl.search = "";
  return NextResponse.redirect(loginUrl);
}

export const config = {
  // Protege tudo, menos arquivos do próprio Next e imagens da pasta public.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|webp|ico)$).*)"]
};

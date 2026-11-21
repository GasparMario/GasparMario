import { NextRequest, NextResponse } from "next/server";
import { getCurrentAppUser } from "@/lib/auth-users";
import { ACTIVE_STORE_COOKIE, listStoresForUser } from "@/lib/stores";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Troca a loja em que a pessoa está trabalhando.
export async function POST(request: NextRequest) {
  const user = await getCurrentAppUser();
  if (!user) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as { storeId?: string };
  const stores = await listStoresForUser(user);
  const store = stores.find((s) => s.id === body.storeId);
  if (!store) {
    return NextResponse.json({ error: "Você não tem acesso a essa loja." }, { status: 403 });
  }

  const response = NextResponse.json({ ok: true, store });
  response.cookies.set(ACTIVE_STORE_COOKIE, store.id, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365
  });
  return response;
}

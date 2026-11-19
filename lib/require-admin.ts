import { NextResponse } from "next/server";
import { getCurrentAppUser, type AppUser } from "@/lib/auth-users";

// Garante que quem chamou é administrador.
// Devolve { admin } se for, ou { response } com o erro para devolver na rota.
export async function requireAdmin(): Promise<
  { admin: AppUser; response?: undefined } | { admin?: undefined; response: NextResponse }
> {
  const user = await getCurrentAppUser();
  if (!user) {
    return { response: NextResponse.json({ error: "Não autorizado." }, { status: 401 }) };
  }
  if (!user.isAdmin) {
    return {
      response: NextResponse.json(
        { error: "Só administradores podem gerenciar usuários." },
        { status: 403 }
      )
    };
  }
  return { admin: user };
}

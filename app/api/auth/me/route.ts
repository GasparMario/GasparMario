import { NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/auth-users";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getCurrentSession();
  if (!session) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }
  return NextResponse.json({ uid: session.uid, email: session.email });
}

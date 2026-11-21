import { NextRequest, NextResponse } from "next/server";
import { listAppUsers, parseSku, setNextSku } from "@/lib/auth-users";
import { isBlingConfigured } from "@/lib/bling";
import { requireAdmin } from "@/lib/require-admin";
import { createStore, getNextSkus, getStoreMembers, listAllStores } from "@/lib/stores";
import { getSupabaseServerClient } from "@/lib/supabase-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Lista as lojas com membros, Bling e próximo SKU. Só administradores.
export async function GET() {
  try {
    const { response } = await requireAdmin();
    if (response) return response;

    const [stores, members, skus, users, conns] = await Promise.all([
      listAllStores(),
      getStoreMembers(),
      getNextSkus(),
      listAppUsers(),
      getSupabaseServerClient().from("bling_connections").select("owner_id,connected_at")
    ]);

    const connected = new Map(
      ((conns.data ?? []) as { owner_id: string; connected_at: string }[]).map((c) => [
        c.owner_id,
        c.connected_at
      ])
    );

    return NextResponse.json({
      blingConfigured: isBlingConfigured(),
      users: users.map((u) => ({ id: u.id, name: u.name, email: u.email, isAdmin: u.isAdmin })),
      stores: stores.map((s) => ({
        ...s,
        memberIds: members.get(s.id) ?? [],
        nextSku: skus.get(s.id) ?? null,
        blingConnectedAt: connected.get(s.id) ?? null
      }))
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Erro ao listar lojas." },
      { status: 500 }
    );
  }
}

// Cria uma loja.
export async function POST(request: NextRequest) {
  try {
    const { response } = await requireAdmin();
    if (response) return response;

    const body = (await request.json()) as {
      name?: string;
      memberIds?: string[];
      startSku?: string | number;
    };
    const name = (body.name || "").trim();
    if (!name) return NextResponse.json({ error: "Informe o nome da loja." }, { status: 400 });

    const hasStart = body.startSku != null && String(body.startSku).trim() !== "";
    const startSku = hasStart ? parseSku(body.startSku) : null;
    if (hasStart && !startSku) {
      return NextResponse.json(
        { error: "O SKU inicial precisa ser só números (ex: 100001)." },
        { status: 400 }
      );
    }

    const store = await createStore(name, body.memberIds ?? []);
    if (startSku) await setNextSku(store.id, startSku);

    return NextResponse.json({ store }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Erro ao criar loja." },
      { status: 400 }
    );
  }
}

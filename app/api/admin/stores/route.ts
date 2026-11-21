import { NextRequest, NextResponse } from "next/server";
import { listAppUsers, parseSku, setNextSku } from "@/lib/auth-users";
import { isBlingConfigured } from "@/lib/bling";
import { requireAdmin } from "@/lib/require-admin";
import {
  createStore,
  getAllPrefixes,
  getNextSkus,
  getStoreMembers,
  listAllStores,
  setStorePrefix
} from "@/lib/stores";
import { isValidPrefix, normalizePrefix } from "@/lib/sku";
import { getSupabaseServerClient } from "@/lib/supabase-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Lista as lojas com membros, Bling e próximo SKU. Só administradores.
export async function GET() {
  try {
    const { response } = await requireAdmin();
    if (response) return response;

    const [stores, members, skus, prefixes, users, conns] = await Promise.all([
      listAllStores(),
      getStoreMembers(),
      getNextSkus(),
      getAllPrefixes(),
      listAppUsers(),
      getSupabaseServerClient().from("bling_connections").select("owner_id,connected_at")
    ]);

    const apps = await getSupabaseServerClient()
      .from("stores")
      .select("id,bling_client_id,bling_client_secret");
    const ownApps = new Map(
      (
        (apps.data ?? []) as {
          id: string;
          bling_client_id: string | null;
          bling_client_secret: string | null;
        }[]
      )
        .filter((a) => a.bling_client_id && a.bling_client_secret)
        .map((a) => [a.id, String(a.bling_client_id).slice(-4)])
    );

    const colorRows = await getSupabaseServerClient().from("colors").select("store_id");
    const colorCounts = new Map<string, number>();
    for (const row of (colorRows.data ?? []) as { store_id: string | null }[]) {
      if (row.store_id) colorCounts.set(row.store_id, (colorCounts.get(row.store_id) ?? 0) + 1);
    }

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
        blingConnectedAt: connected.get(s.id) ?? null,
        colorCount: colorCounts.get(s.id) ?? 0,
        skuPrefix: prefixes.get(s.id) ?? "",
        // Só os 4 últimos caracteres do Client ID; o Secret nunca sai do servidor.
        ownAppHint: ownApps.get(s.id) ?? null
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
      skuPrefix?: string;
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

    const prefix = normalizePrefix(body.skuPrefix || "");
    if (prefix && !isValidPrefix(prefix)) {
      return NextResponse.json(
        { error: "O prefixo do SKU precisa ter de 2 a 5 letras (ex: RES)." },
        { status: 400 }
      );
    }
    if (prefix && Array.from((await getAllPrefixes()).values()).some((p) => p.toUpperCase() === prefix)) {
      return NextResponse.json(
        { error: "Esse prefixo já é usado por outra loja. Escolha outro." },
        { status: 400 }
      );
    }

    const store = await createStore(name, body.memberIds ?? []);
    if (prefix) await setStorePrefix(store.id, prefix);
    if (startSku) await setNextSku(store.id, startSku);

    return NextResponse.json({ store }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Erro ao criar loja." },
      { status: 400 }
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import { parseSku, setNextSku } from "@/lib/auth-users";
import { requireAdmin } from "@/lib/require-admin";
import { disconnect } from "@/lib/bling";
import { deleteStore, listAllStores, renameStore, setStoreMembers } from "@/lib/stores";
import { getSupabaseServerClient } from "@/lib/supabase-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Altera uma loja: nome, quem tem acesso e/ou próximo SKU. Só administradores.
export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { response } = await requireAdmin();
    if (response) return response;

    const stores = await listAllStores();
    if (!stores.some((s) => s.id === params.id)) {
      return NextResponse.json({ error: "Loja não encontrada." }, { status: 404 });
    }

    const body = (await request.json()) as {
      name?: string;
      memberIds?: string[];
      nextSku?: string | number;
      blingClientId?: string;
      blingClientSecret?: string;
      removeBlingApp?: boolean;
    };

    if (body.name != null) {
      const name = body.name.trim();
      if (!name) return NextResponse.json({ error: "Informe o nome da loja." }, { status: 400 });
      await renameStore(params.id, name);
    }

    if (Array.isArray(body.memberIds)) {
      await setStoreMembers(params.id, body.memberIds);
    }

    if (body.nextSku != null) {
      const nextSku = parseSku(body.nextSku);
      if (!nextSku) {
        return NextResponse.json(
          { error: "O SKU precisa ser só números (ex: 100001)." },
          { status: 400 }
        );
      }
      await setNextSku(params.id, nextSku);
    }

    // App próprio do Bling da loja (criado no Bling dela).
    if (body.removeBlingApp || body.blingClientId != null || body.blingClientSecret != null) {
      const clientId = (body.blingClientId || "").trim();
      const clientSecret = (body.blingClientSecret || "").trim();

      if (!body.removeBlingApp && (!clientId || !clientSecret)) {
        return NextResponse.json(
          { error: "Informe o Client ID e o Client Secret do app do Bling desta loja." },
          { status: 400 }
        );
      }

      const { error } = await getSupabaseServerClient()
        .from("stores")
        .update({
          bling_client_id: body.removeBlingApp ? null : clientId,
          bling_client_secret: body.removeBlingApp ? null : clientSecret
        })
        .eq("id", params.id);
      if (error) {
        return NextResponse.json(
          {
            error: `${error.message}. O comando SQL do app por loja já foi rodado no Supabase?`
          },
          { status: 400 }
        );
      }

      // A conexão antiga pertence ao app anterior; precisa conectar de novo.
      await disconnect(params.id);
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Erro ao alterar loja." },
      { status: 400 }
    );
  }
}

// Exclui uma loja (cores, SKU, conexão com o Bling e membros). Só administradores.
export async function DELETE(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { response } = await requireAdmin();
    if (response) return response;

    const stores = await listAllStores();
    if (!stores.some((s) => s.id === params.id)) {
      return NextResponse.json({ error: "Loja não encontrada." }, { status: 404 });
    }

    await deleteStore(params.id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Erro ao excluir loja." },
      { status: 400 }
    );
  }
}

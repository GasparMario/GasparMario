import { NextRequest, NextResponse } from "next/server";
import { parseSku, setNextSku } from "@/lib/auth-users";
import { requireAdmin } from "@/lib/require-admin";
import { listAllStores, renameStore, setStoreMembers } from "@/lib/stores";

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

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Erro ao alterar loja." },
      { status: 400 }
    );
  }
}

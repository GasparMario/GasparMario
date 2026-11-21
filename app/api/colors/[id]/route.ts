import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase-server";
import { getStoreContext } from "@/lib/stores";

function toSlug(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { ctx, response } = await getStoreContext();
    if (response) return response;
    const storeId = ctx.store.id;
    const body = (await request.json()) as { name?: string; slug?: string };
    const name = (body.name || "").trim();
    const slugInput = (body.slug || "").trim();

    const payload: { name?: string; slug?: string } = {};
    if (name) payload.name = name;
    if (slugInput || name) payload.slug = slugInput || toSlug(name);

    if (!Object.keys(payload).length) {
      return NextResponse.json({ error: "nothing to update" }, { status: 400 });
    }

    const supabase = getSupabaseServerClient();
    const { data, error } = await supabase
      .from("colors")
      .update(payload)
      .eq("id", params.id)
      .eq("store_id", storeId)
      .select("id,name,slug,image_url")
      .maybeSingle();

    if (error) {
      const duplicate = /duplicate|unique/i.test(error.message);
      return NextResponse.json(
        { error: duplicate ? "Esta loja já tem uma cor com esse slug." : error.message },
        { status: 400 }
      );
    }

    if (!data) {
      return NextResponse.json({ error: "Cor não encontrada." }, { status: 404 });
    }

    return NextResponse.json({ color: data });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Unexpected error" }, { status: 500 });
  }
}

export async function DELETE(_: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { ctx, response } = await getStoreContext();
    if (response) return response;
    const storeId = ctx.store.id;

    const supabase = getSupabaseServerClient();
    const { data, error } = await supabase
      .from("colors")
      .delete()
      .eq("id", params.id)
      .eq("store_id", storeId)
      .select("id");

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    if (!data || data.length === 0) {
      return NextResponse.json({ error: "Cor não encontrada." }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Unexpected error" }, { status: 500 });
  }
}

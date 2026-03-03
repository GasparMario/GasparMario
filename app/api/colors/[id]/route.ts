import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase-server";

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
      .select("id,name,slug,image_url")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ color: data });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Unexpected error" }, { status: 500 });
  }
}

export async function DELETE(_: NextRequest, { params }: { params: { id: string } }) {
  try {
    const supabase = getSupabaseServerClient();
    const { error } = await supabase.from("colors").delete().eq("id", params.id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Unexpected error" }, { status: 500 });
  }
}

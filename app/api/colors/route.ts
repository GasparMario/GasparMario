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

export async function GET() {
  try {
    const { ctx, response } = await getStoreContext();
    if (response) return response;
    const storeId = ctx.store.id;
    const supabase = getSupabaseServerClient();

    const { data, error } = await supabase
      .from("colors")
      .select("*")
      .eq("store_id", storeId)
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      colors: data ?? []
    });
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? err.message
            : "Unexpected error"
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { ctx, response } = await getStoreContext();
    if (response) return response;
    const storeId = ctx.store.id;
    const body = (await request.json()) as {
      name?: string;
      slug?: string;
    };

    const name = (body.name || "").trim();

    if (!name) {
      return NextResponse.json(
        { error: "name is required" },
        { status: 400 }
      );
    }

    const slug =
      (body.slug || "").trim() || toSlug(name);

    const supabase = getSupabaseServerClient();

    const { data: existing } = await supabase
      .from("colors")
      .select("*")
      .eq("slug", slug)
      .eq("store_id", storeId)
      .maybeSingle();

    if (existing) {
      return NextResponse.json(
        { color: existing },
        { status: 200 }
      );
    }

    const { data, error } = await supabase
      .from("colors")
      .insert({
        name,
        slug,
        store_id: storeId,
        owner_id: ctx.user.id
      })
      .select("*")
      .single();

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { color: data },
      { status: 201 }
    );
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? err.message
            : "Unexpected error"
      },
      { status: 500 }
    );
  }
}
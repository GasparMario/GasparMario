import { NextRequest, NextResponse } from "next/server";
import { getStorageBucket, getSupabaseServerClient } from "@/lib/supabase-server";

function safeExt(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase() || "jpg";
  return ext.replace(/[^a-z0-9]/g, "") || "jpg";
}

function randomSuffix(): string {
  return Math.random().toString(36).slice(2, 8);
}

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const formData = await request.formData();
    const image = formData.get("image");

    if (!(image instanceof File)) {
      return NextResponse.json({ error: "image is required" }, { status: 400 });
    }

    const supabase = getSupabaseServerClient();

    const { data: color, error: colorError } = await supabase
      .from("colors")
      .select("id,slug")
      .eq("id", params.id)
      .single();

    if (colorError || !color?.slug) {
      return NextResponse.json({ error: colorError?.message || "color not found" }, { status: 404 });
    }

    const slug = color.slug;
    const ext = safeExt(image.name);
    const timestamp = Date.now();
    const rand = randomSuffix();
    const filePath = `colors/${slug}/${slug}-${timestamp}-${rand}.${ext}`;

    const arrayBuffer = await image.arrayBuffer();
    const bucket = getStorageBucket();

    const { error: uploadError } = await supabase.storage
      .from(bucket)
      .upload(filePath, arrayBuffer, { contentType: image.type || "image/jpeg", upsert: false });

    if (uploadError) {
      return NextResponse.json({ error: uploadError.message }, { status: 400 });
    }

    const { data: publicUrlData } = supabase.storage.from(bucket).getPublicUrl(filePath);
    const imageUrl = publicUrlData.publicUrl;

    const { data, error } = await supabase
      .from("colors")
      .update({ image_url: imageUrl })
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

import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { ensurePdfFile, normalizeArtName } from "@/lib/dtf";
import { listArts } from "@/lib/dtf-repository";
import { getDtfBucketName, getSupabaseClient } from "@/lib/supabase";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const q = searchParams.get("q")?.trim() || "";
    const items = await listArts(q);

    return NextResponse.json({ items });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao listar artes";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const nomeArte = String(formData.get("nomeArte") || "").trim();
    const tags = String(formData.get("tags") || "").trim();
    const file = formData.get("pdf");

    if (!nomeArte) {
      return NextResponse.json({ error: "Informe o nome da arte." }, { status: 400 });
    }

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Selecione um arquivo PDF." }, { status: 400 });
    }

    ensurePdfFile(file);

    const supabase = getSupabaseClient();
    const bucket = getDtfBucketName();
    const extension = file.name.split(".").pop()?.toLowerCase() || "pdf";
    const filename = `${Date.now()}-${randomUUID()}.${extension}`;
    const storagePath = `${normalizeArtName(nomeArte).replace(/\s+/g, "-")}/${filename}`;

    const fileBuffer = Buffer.from(await file.arrayBuffer());

    const uploadResult = await supabase.storage.from(bucket).upload(storagePath, fileBuffer, {
      cacheControl: "3600",
      contentType: "application/pdf",
      upsert: false
    });

    if (uploadResult.error) {
      throw uploadResult.error;
    }

    const publicUrlResult = supabase.storage.from(bucket).getPublicUrl(storagePath);
    const publicUrl = publicUrlResult.data.publicUrl;

    const payload = {
      nome_arte: nomeArte,
      nome_normalizado: normalizeArtName(nomeArte),
      tags: tags || null,
      storage_path: storagePath,
      public_url: publicUrl
    };

    const { data, error } = await supabase
      .from("artes_dtf")
      .insert(payload)
      .select("id,nome_arte,nome_normalizado,tags,storage_path,public_url,created_at")
      .single();

    if (error) {
      throw error;
    }

    return NextResponse.json({ item: data }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao salvar arte";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

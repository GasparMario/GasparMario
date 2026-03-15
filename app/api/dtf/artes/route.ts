import { NextResponse } from "next/server";
import { CreateDtfArtPayload, normalizeArtName } from "@/lib/dtf";
import { listArts } from "@/lib/dtf-repository";
import { getSupabaseClient } from "@/lib/supabase";

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
    const contentType = request.headers.get("content-type") || "";
    if (!contentType.includes("application/json")) {
      return NextResponse.json(
        { error: "Formato inválido. Envie apenas JSON com metadados da arte." },
        { status: 415 }
      );
    }

    const body = (await request.json()) as Partial<CreateDtfArtPayload>;

    const nome = String(body.nome || "").trim();
    const nomeNormalizado = String(body.nome_normalizado || "").trim();
    const tags = body.tags ? String(body.tags).trim() : null;
    const arquivoPath = String(body.arquivo_path || "").trim();
    const arquivoNomeOriginal = String(body.arquivo_nome_original || "").trim();
    const tamanhoBytes = Number(body.tamanho_bytes || 0);

    if (!nome) {
      return NextResponse.json({ error: "Informe o nome da arte." }, { status: 400 });
    }

    if (!arquivoPath || !arquivoNomeOriginal || !Number.isFinite(tamanhoBytes) || tamanhoBytes <= 0) {
      return NextResponse.json({ error: "Metadados do arquivo inválidos." }, { status: 400 });
    }

    const supabase = getSupabaseClient();
    const payload = {
      nome,
      nome_normalizado: nomeNormalizado || normalizeArtName(nome),
      tags,
      arquivo_path: arquivoPath,
      arquivo_nome_original: arquivoNomeOriginal,
      tamanho_bytes: tamanhoBytes
    };

    const { data, error } = await supabase
      .from("artes_dtf")
      .insert(payload)
      .select("id,nome,nome_normalizado,tags,arquivo_path,arquivo_nome_original,tamanho_bytes,created_at")
      .single();

    if (error) {
      throw error;
    }

    return NextResponse.json({ item: data }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao salvar metadados da arte";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
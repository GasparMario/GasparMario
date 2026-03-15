import { DtfArt, normalizeArtName } from "@/lib/dtf";
import { getDtfBucketName, getSupabaseClient } from "@/lib/supabase";

type DtfRow = {
  id: string;
  nome: string;
  nome_normalizado: string;
  tags: string | null;
  arquivo_path: string;
  arquivo_nome_original: string;
  tamanho_bytes: number;
  created_at: string;
};

export async function listArts(query: string): Promise<DtfArt[]> {
  const supabase = getSupabaseClient();
  const normalized = normalizeArtName(query);

  let dbQuery = supabase
    .from("artes_dtf")
    .select("id,nome,nome_normalizado,tags,arquivo_path,arquivo_nome_original,tamanho_bytes,created_at")
    .order("created_at", { ascending: false });

  if (normalized) {
    dbQuery = dbQuery.ilike("nome_normalizado", `%${normalized}%`);
  }

  const { data, error } = await dbQuery;

  if (error) {
    throw new Error(error.message);
  }

  const bucket = getDtfBucketName();
  const rows = (data || []) as DtfRow[];

  const items = await Promise.all(
    rows.map(async (row) => {
      const signed = await supabase.storage.from(bucket).createSignedUrl(row.arquivo_path, 60 * 60);

      if (signed.error) {
        throw new Error(`Erro ao gerar link de download: ${signed.error.message}`);
      }

      return {
        ...row,
        download_url: signed.data.signedUrl
      };
    })
  );

  return items;
}
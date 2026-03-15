import { DtfArt, normalizeArtName } from "@/lib/dtf";
import { getSupabaseClient } from "@/lib/supabase";

export async function listArts(query: string): Promise<DtfArt[]> {
  const supabase = getSupabaseClient();
  const normalized = normalizeArtName(query);

  let dbQuery = supabase
    .from("artes_dtf")
    .select("id,nome_arte,nome_normalizado,tags,storage_path,public_url,created_at")
    .order("created_at", { ascending: false });

  if (normalized) {
    dbQuery = dbQuery.ilike("nome_normalizado", `%${normalized}%`);
  }

  const { data, error } = await dbQuery;

  if (error) {
    throw new Error(error.message);
  }

  return (data || []) as DtfArt[];
}

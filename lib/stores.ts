// Lojas: cada loja tem o próprio Bling, as próprias cores e a própria
// sequência de SKU. Usuários são ligados às lojas (store_members).
// Administradores enxergam todas as lojas.

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getCurrentAppUser, type AppUser } from "@/lib/auth-users";
import { getSupabaseServerClient } from "@/lib/supabase-server";

export const ACTIVE_STORE_COOKIE = "ellos_store";

export type Store = { id: string; name: string };

export async function listAllStores(): Promise<Store[]> {
  const { data, error } = await getSupabaseServerClient()
    .from("stores")
    .select("id,name")
    .order("name", { ascending: true });
  if (error) {
    throw new Error(
      `Não consegui ler as lojas: ${error.message}. O comando SQL das lojas já foi rodado no Supabase?`
    );
  }
  return (data as Store[]) ?? [];
}

export async function listStoresForUser(user: AppUser): Promise<Store[]> {
  const all = await listAllStores();
  if (user.isAdmin) return all;

  const { data, error } = await getSupabaseServerClient()
    .from("store_members")
    .select("store_id")
    .eq("user_id", user.id);
  if (error) throw new Error(error.message);

  const allowed = new Set((data ?? []).map((r: { store_id: string }) => r.store_id));
  return all.filter((s) => allowed.has(s.id));
}

export type StoreContext = { user: AppUser; store: Store; stores: Store[] };

// Loja em que a pessoa está trabalhando agora (escolhida no topo da tela).
export async function getStoreContext(): Promise<
  { ctx: StoreContext; response?: undefined } | { ctx?: undefined; response: NextResponse }
> {
  const user = await getCurrentAppUser();
  if (!user) {
    return { response: NextResponse.json({ error: "Não autorizado." }, { status: 401 }) };
  }

  const stores = await listStoresForUser(user);
  if (stores.length === 0) {
    return {
      response: NextResponse.json(
        {
          error: user.isAdmin
            ? "Nenhuma loja criada ainda. Crie uma na página Lojas."
            : "Você ainda não tem acesso a nenhuma loja. Peça ao administrador para liberar.",
          noStore: true
        },
        { status: 403 }
      )
    };
  }

  const wanted = cookies().get(ACTIVE_STORE_COOKIE)?.value;
  const store = stores.find((s) => s.id === wanted) ?? stores[0];
  return { ctx: { user, store, stores } };
}

export async function getStoreMembers(): Promise<Map<string, string[]>> {
  const { data, error } = await getSupabaseServerClient()
    .from("store_members")
    .select("store_id,user_id");
  if (error) throw new Error(error.message);
  const map = new Map<string, string[]>();
  for (const row of (data ?? []) as { store_id: string; user_id: string }[]) {
    map.set(row.store_id, [...(map.get(row.store_id) ?? []), row.user_id]);
  }
  return map;
}

export async function createStore(name: string, memberIds: string[]): Promise<Store> {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase.from("stores").insert({ name }).select("id,name").single();
  if (error || !data) throw new Error(error?.message || "Erro ao criar loja.");
  if (memberIds.length) await setStoreMembers(data.id, memberIds);
  return data as Store;
}

export async function renameStore(id: string, name: string) {
  const { error } = await getSupabaseServerClient().from("stores").update({ name }).eq("id", id);
  if (error) throw new Error(error.message);
}

export async function setStoreMembers(storeId: string, memberIds: string[]) {
  const supabase = getSupabaseServerClient();
  const { error: delError } = await supabase.from("store_members").delete().eq("store_id", storeId);
  if (delError) throw new Error(delError.message);
  const unique = Array.from(new Set(memberIds));
  if (unique.length) {
    const { error } = await supabase
      .from("store_members")
      .insert(unique.map((user_id) => ({ store_id: storeId, user_id })));
    if (error) throw new Error(error.message);
  }
}

export async function addUserToStore(storeId: string, userId: string) {
  const { error } = await getSupabaseServerClient()
    .from("store_members")
    .upsert({ store_id: storeId, user_id: userId }, { onConflict: "store_id,user_id" });
  if (error) throw new Error(error.message);
}

export async function removeUserFromAllStores(userId: string) {
  const { error } = await getSupabaseServerClient()
    .from("store_members")
    .delete()
    .eq("user_id", userId);
  if (error) throw new Error(error.message);
}

// Próximo SKU de cada loja (o contador guarda o último entregue).
export async function getNextSkus(): Promise<Map<string, string>> {
  const { data, error } = await getSupabaseServerClient()
    .from("user_sku_counters")
    .select("owner_id,last_sku");
  const map = new Map<string, string>();
  if (error || !data) return map;
  for (const row of data as { owner_id: string; last_sku: number | string }[]) {
    map.set(row.owner_id, String(Number(row.last_sku) + 1));
  }
  return map;
}

// Exclui uma loja e tudo que é dela: cores, contador de SKU, conexão com o
// Bling e a lista de quem usa. Não mexe no Bling em si (os produtos já
// enviados continuam lá).
export async function deleteStore(storeId: string) {
  const supabase = getSupabaseServerClient();

  const steps: [string, PromiseLike<{ error: { message: string } | null }>][] = [
    ["cores", supabase.from("colors").delete().eq("store_id", storeId)],
    ["contador de SKU", supabase.from("user_sku_counters").delete().eq("owner_id", storeId)],
    ["conexão com o Bling", supabase.from("bling_connections").delete().eq("owner_id", storeId)],
    ["quem usa", supabase.from("store_members").delete().eq("store_id", storeId)]
  ];

  for (const [label, step] of steps) {
    const { error } = await step;
    if (error) throw new Error(`Não consegui apagar ${label} da loja: ${error.message}`);
  }

  const { error } = await supabase.from("stores").delete().eq("id", storeId);
  if (error) throw new Error(error.message);
}

export async function countStoreColors(storeId: string): Promise<number> {
  const { count } = await getSupabaseServerClient()
    .from("colors")
    .select("id", { count: "exact", head: true })
    .eq("store_id", storeId);
  return count ?? 0;
}

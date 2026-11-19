import { createClient, type User } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { SESSION_COOKIE, readSessionToken } from "@/lib/session";

// Marca que diferencia os usuários deste sistema de outros usuários
// que possam existir no mesmo projeto do Supabase.
// Fica em app_metadata, que só o servidor consegue alterar.
const APP_FLAG = "cadastro_ellos";
// Marca de administrador (pode criar/remover acessos e ajustar SKUs).
// O PRIMEIRO usuário do sistema é sempre administrador, mesmo sem a marca.
const ADMIN_FLAG = "cadastro_ellos_admin";

// SKU inicial de quem ainda não tem contador.
export const DEFAULT_START_SKU = 100001;

function env(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Variável de ambiente ausente: ${name}`);
  }
  return value;
}

export function getAuthAdminClient() {
  return createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { persistSession: false, autoRefreshToken: false }
  });
}

export function isAppUser(user: User | null | undefined): boolean {
  return Boolean(user?.app_metadata && user.app_metadata[APP_FLAG] === true);
}

export type AppUser = {
  id: string;
  email: string;
  name: string;
  createdAt: string;
  lastSignInAt: string | null;
  isAdmin: boolean;
  isOwner: boolean; // primeiro usuário do sistema
  nextSku: string | null;
};

async function fetchAllAppUsers(): Promise<User[]> {
  const supabase = getAuthAdminClient();
  const all: User[] = [];

  for (let page = 1; page <= 20; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw new Error(error.message);
    all.push(...data.users);
    if (data.users.length < 1000) break;
  }

  return all.filter(isAppUser).sort((a, b) => a.created_at.localeCompare(b.created_at));
}

async function fetchNextSkus(): Promise<Map<string, string>> {
  const supabase = getAuthAdminClient();
  const { data, error } = await supabase.from("user_sku_counters").select("owner_id,last_sku");
  const map = new Map<string, string>();
  if (error || !data) return map;
  for (const row of data as { owner_id: string; last_sku: number | string }[]) {
    map.set(row.owner_id, String(Number(row.last_sku) + 1));
  }
  return map;
}

export async function listAppUsers(options: { withSku?: boolean } = {}): Promise<AppUser[]> {
  const users = await fetchAllAppUsers();
  const skus = options.withSku ? await fetchNextSkus() : new Map<string, string>();
  const ownerId = users[0]?.id;

  return users.map((user) => ({
    id: user.id,
    email: user.email || "",
    name: String(user.user_metadata?.name || ""),
    createdAt: user.created_at,
    lastSignInAt: user.last_sign_in_at || null,
    isOwner: user.id === ownerId,
    isAdmin: user.id === ownerId || user.app_metadata?.[ADMIN_FLAG] === true,
    nextSku: skus.get(user.id) ?? null
  }));
}

export async function createAppUser(input: {
  email: string;
  password: string;
  name?: string;
  isAdmin?: boolean;
}) {
  const supabase = getAuthAdminClient();
  const email = input.email.trim().toLowerCase();
  const name = (input.name || "").trim();

  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password: input.password,
    email_confirm: true,
    user_metadata: { name },
    app_metadata: { [APP_FLAG]: true, [ADMIN_FLAG]: Boolean(input.isAdmin) }
  });

  if (!error && data.user) {
    return { id: data.user.id, email: data.user.email || email };
  }

  // E-mail já cadastrado no Supabase (neste sistema ou em outro do mesmo projeto).
  if (/already|registered|exists/i.test(error?.message || "")) {
    throw new Error("Já existe um usuário com esse e-mail.");
  }

  throw new Error(translateAuthError(error?.message || "Erro ao criar usuário."));
}

export async function setUserAdmin(id: string, isAdmin: boolean) {
  const supabase = getAuthAdminClient();
  const { data, error: getError } = await supabase.auth.admin.getUserById(id);
  if (getError || !data.user || !isAppUser(data.user)) {
    throw new Error("Usuário não encontrado.");
  }

  const { error } = await supabase.auth.admin.updateUserById(id, {
    app_metadata: { ...data.user.app_metadata, [ADMIN_FLAG]: isAdmin }
  });
  if (error) throw new Error(error.message);
}

export async function deleteAppUser(id: string) {
  const supabase = getAuthAdminClient();
  const { data, error: getError } = await supabase.auth.admin.getUserById(id);
  if (getError || !isAppUser(data.user)) {
    throw new Error("Usuário não encontrado.");
  }

  const { error } = await supabase.auth.admin.deleteUser(id);
  if (error) throw new Error(error.message);
}

// Define qual será o PRÓXIMO SKU sugerido para a pessoa.
// (O contador guarda o último SKU entregue, por isso grava valor - 1.)
export async function setNextSku(ownerId: string, nextSku: number) {
  const supabase = getAuthAdminClient();
  const { error } = await supabase
    .from("user_sku_counters")
    .upsert(
      { owner_id: ownerId, last_sku: nextSku - 1, updated_at: new Date().toISOString() },
      { onConflict: "owner_id" }
    );
  if (error) throw new Error(error.message);
}

export async function getCurrentSession() {
  return readSessionToken(cookies().get(SESSION_COOKIE)?.value);
}

// Id do usuário logado (ou null). O middleware já barra quem não está logado,
// isto é uma segunda checagem dentro de cada rota.
export async function getCurrentUserId(): Promise<string | null> {
  const session = await getCurrentSession();
  return session?.uid ?? null;
}

// O primeiro usuário criado no sistema (o dono das cores antigas).
export async function isFirstAppUser(uid: string): Promise<boolean> {
  const users = await fetchAllAppUsers();
  return users[0]?.id === uid;
}

// Devolve o usuário logado com a informação se é administrador.
export async function getCurrentAppUser(): Promise<AppUser | null> {
  const uid = await getCurrentUserId();
  if (!uid) return null;
  const users = await listAppUsers();
  return users.find((u) => u.id === uid) ?? null;
}

export function validatePassword(password: string): string | null {
  if (password.length < 8) return "A senha precisa ter pelo menos 8 caracteres.";
  return null;
}

export function validateEmail(email: string): string | null {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return "Informe um e-mail válido.";
  return null;
}

export function parseSku(value: unknown): number | null {
  const text = String(value ?? "").trim();
  if (!/^\d+$/.test(text)) return null;
  const n = Number(text);
  return Number.isSafeInteger(n) && n > 0 ? n : null;
}

export function translateAuthError(message: string): string {
  if (/password/i.test(message) && /(weak|short|least|characters)/i.test(message)) {
    return "Senha fraca. Use pelo menos 8 caracteres, misturando letras e números.";
  }
  if (/invalid.*email|email.*invalid/i.test(message)) return "Informe um e-mail válido.";
  return message;
}

import { createClient, type User } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { SESSION_COOKIE, readSessionToken } from "@/lib/session";

// Marca que diferencia os usuários deste sistema de outros usuários
// que possam existir no mesmo projeto do Supabase.
// Fica em app_metadata, que só o servidor consegue alterar.
const APP_FLAG = "cadastro_ellos";

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
};

function toAppUser(user: User): AppUser {
  return {
    id: user.id,
    email: user.email || "",
    name: String(user.user_metadata?.name || ""),
    createdAt: user.created_at,
    lastSignInAt: user.last_sign_in_at || null
  };
}

export async function listAppUsers(): Promise<AppUser[]> {
  const supabase = getAuthAdminClient();
  const all: User[] = [];

  for (let page = 1; page <= 20; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw new Error(error.message);
    all.push(...data.users);
    if (data.users.length < 1000) break;
  }

  return all
    .filter(isAppUser)
    .map(toAppUser)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export async function createAppUser(input: { email: string; password: string; name?: string }) {
  const supabase = getAuthAdminClient();
  const email = input.email.trim().toLowerCase();
  const name = (input.name || "").trim();

  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password: input.password,
    email_confirm: true,
    user_metadata: { name },
    app_metadata: { [APP_FLAG]: true }
  });

  if (!error && data.user) return toAppUser(data.user);

  // E-mail já cadastrado no Supabase (neste sistema ou em outro do mesmo projeto).
  const alreadyExists = /already|registered|exists/i.test(error?.message || "");
  if (alreadyExists) {
    throw new Error("Já existe um usuário com esse e-mail.");
  }

  throw new Error(translateAuthError(error?.message || "Erro ao criar usuário."));
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

export async function getCurrentSession() {
  return readSessionToken(cookies().get(SESSION_COOKIE)?.value);
}

export function validatePassword(password: string): string | null {
  if (password.length < 8) return "A senha precisa ter pelo menos 8 caracteres.";
  return null;
}

export function validateEmail(email: string): string | null {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return "Informe um e-mail válido.";
  return null;
}

export function translateAuthError(message: string): string {
  if (/password/i.test(message) && /(weak|short|least|characters)/i.test(message)) {
    return "Senha fraca. Use pelo menos 8 caracteres, misturando letras e números.";
  }
  if (/invalid.*email|email.*invalid/i.test(message)) return "Informe um e-mail válido.";
  return message;
}

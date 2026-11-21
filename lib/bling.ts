// Integração com a API v3 do Bling (OAuth 2.0).
// Cada LOJA tem o próprio Bling (conectado por um administrador); os tokens ficam na tabela
// bling_connections, coluna owner_id = código da loja (só o servidor acessa).

import { getSupabaseServerClient } from "@/lib/supabase-server";

const AUTHORIZE_URL = "https://www.bling.com.br/Api/v3/oauth/authorize";
const TOKEN_URL = "https://www.bling.com.br/Api/v3/oauth/token";
const API_BASE = "https://api.bling.com.br/Api/v3";

// Renova o acesso um pouco antes de vencer.
const REFRESH_MARGIN_SECONDS = 120;

export class BlingError extends Error {
  status: number;
  details: string[];

  constructor(message: string, status = 500, details: string[] = []) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

function env(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new BlingError(
      `Variável de ambiente ausente: ${name}. Cadastre na Vercel (Settings → Environment Variables).`
    );
  }
  return value;
}

// O app da MG (chaves na Vercel). Só funciona na conta do Bling que criou o app.
export function isBlingConfigured(): boolean {
  return Boolean(process.env.BLING_CLIENT_ID && process.env.BLING_CLIENT_SECRET);
}

export type AppCredentials = { clientId: string; clientSecret: string; ownApp: boolean };

// Chaves do app do Bling que a loja usa: o app PRÓPRIO da loja (criado no
// Bling dela e cadastrado na página Lojas) ou, se não tiver, o app da MG.
export async function getAppCredentials(storeId: string): Promise<AppCredentials | null> {
  const { data } = await getSupabaseServerClient()
    .from("stores")
    .select("bling_client_id,bling_client_secret")
    .eq("id", storeId)
    .maybeSingle();

  const row = data as { bling_client_id?: string | null; bling_client_secret?: string | null } | null;
  if (row?.bling_client_id && row?.bling_client_secret) {
    return { clientId: row.bling_client_id, clientSecret: row.bling_client_secret, ownApp: true };
  }
  if (isBlingConfigured()) {
    return {
      clientId: env("BLING_CLIENT_ID"),
      clientSecret: env("BLING_CLIENT_SECRET"),
      ownApp: false
    };
  }
  return null;
}

async function requireAppCredentials(storeId: string): Promise<AppCredentials> {
  const creds = await getAppCredentials(storeId);
  if (!creds) {
    throw new BlingError(
      "Esta loja não tem aplicativo do Bling cadastrado. Cadastre o Client ID e o Client Secret na página Lojas."
    );
  }
  return creds;
}

export function buildAuthorizeUrl(state: string, clientId: string): string {
  const params = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    state
  });
  // Opcional: o Bling usa o link de redirecionamento cadastrado no app.
  if (process.env.BLING_REDIRECT_URI) {
    params.set("redirect_uri", process.env.BLING_REDIRECT_URI);
  }
  return `${AUTHORIZE_URL}?${params.toString()}`;
}

type TokenResponse = {
  access_token: string;
  refresh_token: string;
  expires_in?: number;
  token_validate?: number;
};

async function postToken(creds: AppCredentials, form: Record<string, string>): Promise<TokenResponse> {
  const basic = Buffer.from(`${creds.clientId}:${creds.clientSecret}`).toString("base64");

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "1.0",
      "enable-jwt": "1"
    },
    body: new URLSearchParams(form).toString(),
    cache: "no-store"
  });

  const json = (await res.json().catch(() => ({}))) as Partial<TokenResponse> & {
    error?: { message?: string; description?: string } | string;
  };

  if (!res.ok || !json.access_token || !json.refresh_token) {
    const err = json.error;
    const message =
      typeof err === "string" ? err : err?.description || err?.message || `HTTP ${res.status}`;
    throw new BlingError(`O Bling recusou a autorização: ${message}`, res.status || 500);
  }

  return json as TokenResponse;
}

async function saveTokens(ownerId: string, tokens: TokenResponse, isNewConnection: boolean) {
  const seconds = Number(tokens.expires_in ?? tokens.token_validate ?? 3600);
  const expiresAt = new Date(Date.now() + seconds * 1000).toISOString();
  const now = new Date().toISOString();

  const row: Record<string, string> = {
    owner_id: ownerId,
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    expires_at: expiresAt,
    updated_at: now
  };
  if (isNewConnection) row.connected_at = now;

  const { error } = await getSupabaseServerClient()
    .from("bling_connections")
    .upsert(row, { onConflict: "owner_id" });

  if (error) {
    throw new BlingError(
      `Não consegui salvar a conexão com o Bling: ${error.message}. O comando SQL da tabela bling_connections já foi rodado no Supabase?`
    );
  }
}

export async function connectWithCode(ownerId: string, code: string) {
  const creds = await requireAppCredentials(ownerId);
  const tokens = await postToken(creds, { grant_type: "authorization_code", code });
  await saveTokens(ownerId, tokens, true);
}

type ConnectionRow = {
  owner_id: string;
  access_token: string;
  refresh_token: string;
  expires_at: string;
  connected_at: string;
};

export async function getConnection(ownerId: string): Promise<ConnectionRow | null> {
  const { data, error } = await getSupabaseServerClient()
    .from("bling_connections")
    .select("owner_id,access_token,refresh_token,expires_at,connected_at")
    .eq("owner_id", ownerId)
    .maybeSingle();

  if (error) {
    throw new BlingError(
      `Não consegui ler a conexão com o Bling: ${error.message}. O comando SQL da tabela bling_connections já foi rodado no Supabase?`
    );
  }
  return (data as ConnectionRow | null) ?? null;
}

export async function disconnect(ownerId: string) {
  const { error } = await getSupabaseServerClient()
    .from("bling_connections")
    .delete()
    .eq("owner_id", ownerId);
  if (error) throw new BlingError(error.message);
}

// Devolve um token válido, renovando sozinho quando está para vencer.
async function getAccessToken(ownerId: string): Promise<string> {
  const conn = await getConnection(ownerId);
  if (!conn) {
    throw new BlingError("O Bling desta loja ainda não está conectado. Um administrador precisa conectar na página Lojas.", 409);
  }

  const expiresAt = new Date(conn.expires_at).getTime();
  if (expiresAt - Date.now() > REFRESH_MARGIN_SECONDS * 1000) {
    return conn.access_token;
  }

  try {
    const creds = await requireAppCredentials(ownerId);
    const tokens = await postToken(creds, {
      grant_type: "refresh_token",
      refresh_token: conn.refresh_token
    });
    await saveTokens(ownerId, tokens, false);
    return tokens.access_token;
  } catch {
    throw new BlingError(
      "A conexão com o Bling desta loja expirou. Um administrador precisa conectar de novo na página Lojas.",
      409
    );
  }
}

type BlingErrorBody = {
  error?: {
    type?: string;
    message?: string;
    description?: string;
    fields?: { msg?: string; element?: string; namespace?: string }[];
  };
};

// Chama a API do Bling em nome do usuário.
export async function blingRequest<T = unknown>(
  ownerId: string,
  path: string,
  init: { method?: "GET" | "POST" | "PUT" | "DELETE"; body?: unknown } = {}
): Promise<T> {
  const token = await getAccessToken(ownerId);

  const res = await fetch(`${API_BASE}${path}`, {
    method: init.method || "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
      "Content-Type": "application/json",
      "enable-jwt": "1"
    },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
    cache: "no-store"
  });

  const text = await res.text();
  const json = text ? (JSON.parse(text) as unknown) : {};

  if (!res.ok) {
    const err = (json as BlingErrorBody).error;
    const details = (err?.fields || [])
      .map((f) => [f.element, f.msg].filter(Boolean).join(": "))
      .filter(Boolean);
    const message = err?.description || err?.message || `O Bling respondeu com erro (HTTP ${res.status}).`;

    if (res.status === 401) {
      throw new BlingError(
        "O Bling não aceitou a conexão desta loja. Um administrador precisa conectar de novo na página Lojas.",
        409,
        details
      );
    }
    throw new BlingError(message, res.status, details);
  }

  return json as T;
}

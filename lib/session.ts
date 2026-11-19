// Sessão de login guardada num cookie assinado.
// Funciona tanto no middleware (Edge) quanto nas rotas da API (Node),
// por isso usa só a Web Crypto API, sem bibliotecas extras.

export const SESSION_COOKIE = "ellos_session";
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7; // 7 dias

export type SessionData = {
  uid: string;
  email: string;
  exp: number; // segundos desde 1970
};

function getSecret(): string {
  // Usa SESSION_SECRET se existir; senão reaproveita a chave secreta do Supabase,
  // que já fica só no servidor (nunca vai para o navegador).
  const secret = process.env.SESSION_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) {
    throw new Error("Variável de ambiente ausente: SESSION_SECRET ou SUPABASE_SERVICE_ROLE_KEY");
  }
  return secret;
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  bytes.forEach((b) => {
    binary += String.fromCharCode(b);
  });
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(value: string) {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function getKey(): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(`ellos-session:${getSecret()}`),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}

export async function createSessionToken(uid: string, email: string): Promise<string> {
  const data: SessionData = {
    uid,
    email,
    exp: Math.floor(Date.now() / 1000) + SESSION_MAX_AGE_SECONDS
  };
  const payload = toBase64Url(new TextEncoder().encode(JSON.stringify(data)));
  const signature = await crypto.subtle.sign("HMAC", await getKey(), new TextEncoder().encode(payload));
  return `${payload}.${toBase64Url(new Uint8Array(signature))}`;
}

export async function readSessionToken(token: string | undefined | null): Promise<SessionData | null> {
  if (!token) return null;

  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;

  try {
    const valid = await crypto.subtle.verify(
      "HMAC",
      await getKey(),
      fromBase64Url(signature),
      new TextEncoder().encode(payload)
    );
    if (!valid) return null;

    const data = JSON.parse(new TextDecoder().decode(fromBase64Url(payload))) as SessionData;
    if (!data.uid || !data.email || typeof data.exp !== "number") return null;
    if (data.exp < Math.floor(Date.now() / 1000)) return null;

    return data;
  } catch {
    return null;
  }
}

export function sessionCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS
  };
}

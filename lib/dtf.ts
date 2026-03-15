export type DtfArt = {
  id: string;
  nome: string;
  nome_normalizado: string;
  tags: string | null;
  arquivo_path: string;
  arquivo_nome_original: string;
  tamanho_bytes: number;
  download_url: string;
  created_at: string;
};

export type CreateDtfArtPayload = {
  nome: string;
  nome_normalizado: string;
  tags: string | null;
  arquivo_path: string;
  arquivo_nome_original: string;
  tamanho_bytes: number;
};

export function normalizeArtName(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}

export function ensurePdfFile(file: File) {
  const isPdfMime = file.type === "application/pdf";
  const hasPdfExtension = file.name.toLowerCase().endsWith(".pdf");

  if (!isPdfMime && !hasPdfExtension) {
    throw new Error("O arquivo enviado não é um PDF válido.");
  }
}

export function formatDate(value: string): string {
  const date = new Date(value);
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short"
  }).format(date);
}

export async function extractErrorMessage(response: Response, fallback: string): Promise<string> {
  const contentType = response.headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
    const payload = (await response.json()) as { error?: string; message?: string };
    return payload.error || payload.message || fallback;
  }

  const text = await response.text();
  return text || fallback;
}
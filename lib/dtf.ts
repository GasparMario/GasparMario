export type DtfArt = {
  id: string;
  nome_arte: string;
  nome_normalizado: string;
  tags: string | null;
  storage_path: string;
  public_url: string;
  created_at: string;
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

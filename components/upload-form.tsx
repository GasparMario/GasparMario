"use client";

import { FormEvent, useState } from "react";
import { ensurePdfFile, extractErrorMessage, normalizeArtName } from "@/lib/dtf";
import { getPublicDtfBucketName, getSupabaseBrowserClient } from "@/lib/supabase-browser";

function buildStoragePath(nomeArte: string, fileName: string): string {
  const extension = fileName.split(".").pop()?.toLowerCase() || "pdf";
  const safeFolder = normalizeArtName(nomeArte).replace(/\s+/g, "-") || "arte";
  const randomPart = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
  return `${safeFolder}/${Date.now()}-${randomPart}.${extension}`;
}

export function UploadForm() {
  const [nomeArte, setNomeArte] = useState("");
  const [tags, setTags] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccess(null);
    setStatusMessage(null);

    if (!file) {
      setError("Selecione um PDF.");
      return;
    }

    try {
      ensurePdfFile(file);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Apenas arquivos PDF são permitidos.");
      return;
    }

    if (!nomeArte.trim()) {
      setError("Informe o nome da arte.");
      return;
    }

    setIsLoading(true);

    const bucket = getPublicDtfBucketName();
    const supabase = getSupabaseBrowserClient();
    const storagePath = buildStoragePath(nomeArte, file.name);

    try {
      setStatusMessage("Enviando PDF para o Storage...");
      const uploadResult = await supabase.storage.from(bucket).upload(storagePath, file, {
        contentType: "application/pdf",
        upsert: false,
        cacheControl: "3600"
      });

      if (uploadResult.error) {
        throw new Error(`Falha no upload do arquivo: ${uploadResult.error.message}`);
      }

      setStatusMessage("Salvando metadados da arte...");
      const metadataResponse = await fetch("/api/dtf/artes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nome: nomeArte.trim(),
          nome_normalizado: normalizeArtName(nomeArte),
          tags: tags.trim() || null,
          arquivo_path: storagePath,
          arquivo_nome_original: file.name,
          tamanho_bytes: file.size
        })
      });

      if (!metadataResponse.ok) {
        const message = await extractErrorMessage(metadataResponse, "Erro ao salvar metadados da arte.");
        await supabase.storage.from(bucket).remove([storagePath]);
        throw new Error(message);
      }

      setNomeArte("");
      setTags("");
      setFile(null);
      setStatusMessage(null);
      const fileInput = document.getElementById("pdf-input") as HTMLInputElement | null;
      if (fileInput) {
        fileInput.value = "";
      }
      setSuccess("Arte enviada com sucesso! Upload direto concluído.");
    } catch (err) {
      setStatusMessage(null);
      setError(err instanceof Error ? err.message : "Erro inesperado ao enviar arquivo.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="upload-form">
      <label>
        Nome da arte
        <input
          type="text"
          value={nomeArte}
          onChange={(event) => setNomeArte(event.target.value)}
          className="text-input"
          required
        />
      </label>

      <label>
        Tags
        <input
          type="text"
          value={tags}
          onChange={(event) => setTags(event.target.value)}
          className="text-input"
          placeholder="Ex: floral, infantil, neon"
        />
      </label>

      <label>
        Arquivo PDF
        <input
          id="pdf-input"
          type="file"
          accept="application/pdf,.pdf"
          onChange={(event) => setFile(event.target.files?.[0] || null)}
          required
        />
      </label>

      {statusMessage ? <p className="feedback info">{statusMessage}</p> : null}
      {error ? <p className="feedback error">{error}</p> : null}
      {success ? <p className="feedback success">{success}</p> : null}

      <button type="submit" className="button-primary" disabled={isLoading}>
        {isLoading ? "Processando upload..." : "Salvar"}
      </button>
    </form>
  );
}

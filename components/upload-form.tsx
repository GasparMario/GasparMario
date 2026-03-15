"use client";

import { FormEvent, useState } from "react";

export function UploadForm() {
  const [nomeArte, setNomeArte] = useState("");
  const [tags, setTags] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    if (!file) {
      setError("Selecione um PDF.");
      return;
    }

    if (!file.name.toLowerCase().endsWith(".pdf") && file.type !== "application/pdf") {
      setError("Apenas arquivos PDF são permitidos.");
      return;
    }

    setIsLoading(true);

    try {
      const formData = new FormData();
      formData.append("nomeArte", nomeArte);
      formData.append("tags", tags);
      formData.append("pdf", file);

      const response = await fetch("/api/dtf/artes", {
        method: "POST",
        body: formData
      });

      const payload = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(payload.error || "Erro ao salvar a arte.");
      }

      setNomeArte("");
      setTags("");
      setFile(null);
      const fileInput = document.getElementById("pdf-input") as HTMLInputElement | null;
      if (fileInput) {
        fileInput.value = "";
      }
      setSuccess("Arte enviada com sucesso!");
    } catch (err) {
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

      {error ? <p className="feedback error">{error}</p> : null}
      {success ? <p className="feedback success">{success}</p> : null}

      <button type="submit" className="button-primary" disabled={isLoading}>
        {isLoading ? "Salvando..." : "Salvar"}
      </button>
    </form>
  );
}

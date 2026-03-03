"use client";

import { useEffect, useMemo, useState } from "react";

type Color = {
  id: string;
  name: string;
  slug: string;
  image_url: string | null;
};

function escapeCsv(value: string): string {
  if (value.includes(",") || value.includes("\n") || value.includes('"')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function downloadCsv(filename: string, content: string) {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function AdminPage() {
  const [colors, setColors] = useState<Color[]>([]);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [editingColorId, setEditingColorId] = useState<string | null>(null);
  const [sizesInput, setSizesInput] = useState("P,M,G");
  const [productName, setProductName] = useState("Produto Exemplo");
  const [parentSku, setParentSku] = useState("PROD-001");
  const [selectedColorIds, setSelectedColorIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function loadColors() {
    const res = await fetch("/api/colors", { cache: "no-store" });
    const json = await res.json();
    if (!res.ok) {
      throw new Error(json.error || "Erro ao listar cores");
    }
    setColors(json.colors);
  }

  useEffect(() => {
    loadColors().catch((err) => setError(err.message));
  }, []);

  async function handleCreateColor(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const res = await fetch("/api/colors", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, slug })
    });
    const json = await res.json();

    if (!res.ok) {
      setError(json.error || "Erro ao criar cor");
      return;
    }

    setName("");
    setSlug("");
    await loadColors();
    setSelectedColorIds((prev) => (prev.includes(json.color.id) ? prev : [json.color.id, ...prev]));
  }

  function startEdit(color: Color) {
    setEditingColorId(color.id);
    setName(color.name);
    setSlug(color.slug);
    setError(null);
  }

  function cancelEdit() {
    setEditingColorId(null);
    setName("");
    setSlug("");
    setError(null);
  }

  async function handleUpdateColor(e: React.FormEvent) {
    e.preventDefault();
    if (!editingColorId) return;
    setError(null);

    const res = await fetch(`/api/colors/${editingColorId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, slug })
    });
    const json = await res.json();

    if (!res.ok) {
      setError(json.error || "Erro ao editar cor");
      return;
    }

    cancelEdit();
    await loadColors();
  }

  async function handleDeleteColor(colorId: string) {
    setError(null);
    const res = await fetch(`/api/colors/${colorId}`, { method: "DELETE" });
    const json = await res.json();

    if (!res.ok) {
      setError(json.error || "Erro ao remover cor");
      return;
    }

    setSelectedColorIds((prev) => prev.filter((id) => id !== colorId));
    await loadColors();
  }

  async function handleUpload(colorId: string, file: File | null) {
    if (!file) return;
    setError(null);

    const form = new FormData();
    form.append("image", file);

    const res = await fetch(`/api/colors/${colorId}/image`, { method: "POST", body: form });
    const json = await res.json();

    if (!res.ok) {
      setError(json.error || "Erro ao subir imagem");
      return;
    }

    await loadColors();
  }

  const selectedColors = useMemo(
    () => colors.filter((c) => selectedColorIds.includes(c.id)),
    [colors, selectedColorIds]
  );

  function handleExport() {
    const sizes = sizesInput
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    const parentImages = Array.from(new Set(selectedColors.map((c) => c.image_url).filter(Boolean) as string[]));

    const headers = [
      "Type",
      "SKU",
      "Name",
      "Parent",
      "Attribute 1 name",
      "Attribute 1 value(s)",
      "Attribute 2 name",
      "Attribute 2 value(s)",
      "Images"
    ];

    const rows: string[][] = [
      [
        "variable",
        parentSku,
        productName,
        "",
        "pa_cor",
        selectedColors.map((c) => c.name).join(","),
        "pa_tamanho",
        sizes.join(","),
        parentImages.join(",")
      ]
    ];

    for (const color of selectedColors) {
      for (const size of sizes) {
        rows.push([
          "variation",
          `${parentSku}-${color.slug}-${size}`,
          `${productName} - ${color.name} - ${size}`,
          parentSku,
          "pa_cor",
          color.name,
          "pa_tamanho",
          size,
          color.image_url || ""
        ]);
      }
    }

    const csv = [headers, ...rows]
      .map((line) => line.map((v) => escapeCsv(v)).join(","))
      .join("\n");

    downloadCsv("woocommerce-import.csv", csv);
  }

  return (
    <main style={{ fontFamily: "sans-serif", margin: "32px auto", maxWidth: 1000 }}>
      <h1>Admin - Importador WooCommerce</h1>

      <section style={{ border: "1px solid #ddd", borderRadius: 8, padding: 16, marginBottom: 20 }}>
        <h2>Cores</h2>

        <form onSubmit={editingColorId ? handleUpdateColor : handleCreateColor} style={{ display: "grid", gap: 8 }}>
          <label>
            Nome da cor
            <input value={name} onChange={(e) => setName(e.target.value)} required style={{ width: "100%" }} />
          </label>
          <label>
            Slug (opcional)
            <input value={slug} onChange={(e) => setSlug(e.target.value)} style={{ width: "100%" }} />
          </label>

          <div style={{ display: "flex", gap: 8 }}>
            <button type="submit">{editingColorId ? "Salvar edição" : "Adicionar cor"}</button>
            {editingColorId ? (
              <button type="button" onClick={cancelEdit}>
                Cancelar
              </button>
            ) : null}
          </div>
        </form>

        <div style={{ display: "grid", gap: 10, marginTop: 16 }}>
          {colors.map((color) => (
            <div key={color.id} style={{ border: "1px solid #eee", padding: 12, borderRadius: 6 }}>
              <strong>{color.name}</strong> <small>({color.slug})</small>
              <div>
                {color.image_url ? (
                  <a href={color.image_url} target="_blank" rel="noreferrer">
                    imagem atual
                  </a>
                ) : (
                  <small>sem imagem</small>
                )}
              </div>

              <input
                type="file"
                accept="image/*"
                onChange={(e) => handleUpload(color.id, e.target.files?.[0] || null)}
              />

              <div style={{ marginTop: 8, display: "flex", gap: 8 }}>
                <button type="button" onClick={() => startEdit(color)}>
                  Editar
                </button>
                <button type="button" onClick={() => handleDeleteColor(color.id)}>
                  Excluir
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section style={{ border: "1px solid #ddd", borderRadius: 8, padding: 16 }}>
        <h2>Export CSV</h2>
        <label>
          Nome do produto
          <input value={productName} onChange={(e) => setProductName(e.target.value)} style={{ width: "100%" }} />
        </label>
        <label>
          SKU do pai
          <input value={parentSku} onChange={(e) => setParentSku(e.target.value)} style={{ width: "100%" }} />
        </label>
        <label>
          Tamanhos (separados por vírgula)
          <input value={sizesInput} onChange={(e) => setSizesInput(e.target.value)} style={{ width: "100%" }} />
        </label>

        <p>Selecione as cores:</p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,minmax(0,1fr))", gap: 6 }}>
          {colors.map((color) => {
            const checked = selectedColorIds.includes(color.id);
            return (
              <label key={color.id}>
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setSelectedColorIds((prev) => [...prev, color.id]);
                    } else {
                      setSelectedColorIds((prev) => prev.filter((id) => id !== color.id));
                    }
                  }}
                />
                {color.name}
              </label>
            );
          })}
        </div>

        <button onClick={handleExport} style={{ marginTop: 16 }}>
          Exportar CSV WooCommerce
        </button>
      </section>

      {error ? <p style={{ color: "crimson" }}>{error}</p> : null}
    </main>
  );
}

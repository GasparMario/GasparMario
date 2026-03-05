"use client";

import { useEffect, useMemo, useState } from "react";
import styles from "./admin.module.css";
import { buildOrderedVariations } from "@/lib/sku";

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

function normalizeDecimal(value: string): string {
  const cleaned = value.trim();
  if (!cleaned) return "";
  return cleaned.replace(/\s+/g, "").replace(",", ".");
}

export default function AdminPage() {
  const [colors, setColors] = useState<Color[]>([]);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [editingColorId, setEditingColorId] = useState<string | null>(null);
  const [sizesInput, setSizesInput] = useState("P,M,G");
  const [productName, setProductName] = useState("Produto Exemplo");
  const [parentSku, setParentSku] = useState("100001");
  const [priceInput, setPriceInput] = useState("");
  const [weightInput, setWeightInput] = useState("");
  const [selectedColorIds, setSelectedColorIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isGeneratingSku, setIsGeneratingSku] = useState(false);

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

  async function handleGenerateNextSku() {
    setError(null);
    setIsGeneratingSku(true);

    try {
      const res = await fetch("/api/sku/next", { cache: "no-store" });
      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.error || "Erro ao gerar próximo SKU");
      }

      if (!json.sku || !/^\d+$/.test(String(json.sku))) {
        throw new Error("API retornou SKU inválido");
      }

      setParentSku(String(json.sku));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao gerar SKU");
    } finally {
      setIsGeneratingSku(false);
    }
  }

  function handleExport() {
    setError(null);

    const skuBase = parentSku.trim();
    if (!/^\d+$/.test(skuBase)) {
      setError("SKU do pai deve ser numérico (ex: 100001)");
      return;
    }

    const normalizedPrice = normalizeDecimal(priceInput);
    const normalizedWeight = normalizeDecimal(weightInput);

    const sizes = sizesInput
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    const orderedColors = [...selectedColors].sort((a, b) => a.slug.localeCompare(b.slug));
    const parentImages = Array.from(new Set(orderedColors.map((c) => c.image_url).filter(Boolean) as string[]));

    const headers = [
      "Type",
      "SKU",
      "Name",
      "Regular price",
      "Weight (kg)",
      "Parent",
      "Attribute 1 name",
      "Attribute 1 value(s)",
      "Attribute 1 visible",
      "Attribute 1 global",
      "Attribute 2 name",
      "Attribute 2 value(s)",
      "Attribute 2 visible",
      "Attribute 2 global",
      "In stock?",
      "Manage stock?",
      "Stock",
      "Images"
    ];

    const rows: string[][] = [
      [
        "variable",
        skuBase,
        productName,
        normalizedPrice,
        normalizedWeight,
        "",

        sizes.join(","),
        "1",
        "1",
        "1",
        "0",
        "",
        parentImages.join(",")
      ]
    ];

    const orderedVariations = buildOrderedVariations(orderedColors, sizes);

    orderedVariations.forEach(({ color, size }, index) => {
      const suffix = String(index + 1).padStart(2, "0");

      rows.push([
        "variation",
        `${skuBase}${suffix}`,
        `${productName} - ${color.name} - ${size}`,
        normalizedPrice,
        normalizedWeight,
        skuBase,

    const csv = [headers, ...rows]
      .map((line, rowIndex) =>
        line
          .map((v, columnIndex) => {
            if (rowIndex > 0 && forceQuotedColumns.has(columnIndex) && v) {
              return quoteCsvString(v);
            }
            return escapeCsv(v);
          })
          .join(",")
      )
      .join("\n");

    downloadCsv("woocommerce-import.csv", csv);
  }

  return (
    <main className={styles.shell}>
      <header className={styles.header}>
        <h1>Admin · Importador WooCommerce</h1>
        <p>Gerencie cores e exporte CSV com SKUs pai/filho numéricos.</p>
      </header>

      {error ? <p className={styles.alert}>{error}</p> : null}

      <div className={styles.grid}>
        <section className={styles.card}>
          <div className={styles.cardTitleRow}>
            <h2>Cores</h2>
            <span className={styles.pill}>{colors.length} cadastradas</span>
          </div>

          <form onSubmit={editingColorId ? handleUpdateColor : handleCreateColor} className={styles.formGrid}>
            <label className={styles.label}>
              Nome da cor
              <input className={styles.input} value={name} onChange={(e) => setName(e.target.value)} required />
            </label>
            <label className={styles.label}>
              Slug (opcional)
              <input className={styles.input} value={slug} onChange={(e) => setSlug(e.target.value)} />
            </label>

            <div className={styles.buttonRow}>
              <button className={`${styles.btn} ${styles.btnPrimary}`} type="submit">
                {editingColorId ? "Salvar edição" : "Adicionar cor"}
              </button>
              {editingColorId ? (
                <button className={`${styles.btn} ${styles.btnMuted}`} type="button" onClick={cancelEdit}>
                  Cancelar
                </button>
              ) : null}
            </div>
          </form>

          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Selecionar</th>
                  <th>Cor</th>
                  <th>Slug</th>
                  <th>Imagem</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {colors.map((color) => (
                  <tr key={color.id}>
                    <td>
                      <input
                        type="checkbox"
                        checked={selectedColorIds.includes(color.id)}
                        onChange={(e) => {
                          const checked = e.target.checked;
                          setSelectedColorIds((prev) =>

                          );
                        }}
                      />
                    </td>
                    <td>{color.name}</td>
                    <td>{color.slug}</td>
                    <td>
                      {color.image_url ? (

                        </a>
                      ) : (
                        <span className={styles.muted}>sem imagem</span>
                      )}
                      <input
                        className={`${styles.input} ${styles.fileInput}`}
                        type="file"
                        accept="image/*"
                        onChange={(e) => handleUpload(color.id, e.target.files?.[0] || null)}
                      />
                    </td>
                    <td>
                      <div className={styles.buttonRow}>
                        <button className={`${styles.btn} ${styles.btnMuted}`} type="button" onClick={() => startEdit(color)}>
                          Editar
                        </button>
                        <button className={`${styles.btn} ${styles.btnDanger}`} type="button" onClick={() => handleDeleteColor(color.id)}>
                          Excluir
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

            </label>
          </div>

          <p className={styles.muted}>Variações seguem ordem estável: cor.slug + tamanho. SKU filho = SKU pai + sufixo de 2 dígitos.</p>

          <button className={`${styles.btn} ${styles.btnPrimary}`} type="button" onClick={handleExport}>
            Exportar CSV WooCommerce
          </button>

          <div className={styles.chips}>
            {selectedColors.map((color) => (
              <span key={color.id} className={styles.chip}>
                {color.name}
              </span>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
"use client";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
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

const SIZE_PRESETS = ["P,M,G", "PP,P,M,G,GG", "P,M,G,GG,XG", "PP,P,M,G,GG,XG,G2,G3", "U"];

function quoteCsvString(value: string) {
  return `"${value.replace(/"/g, '""')}"`;
}

export default function AdminPage() {
  const router = useRouter();

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => null);
    router.push("/login");
  }

  const [colors, setColors] = useState<Color[]>([]);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [editingColorId, setEditingColorId] = useState<string | null>(null);
  const [sizesInput, setSizesInput] = useState("P,M,G");
  const [productName, setProductName] = useState("");
  const [parentSku, setParentSku] = useState("");
  const [priceInput, setPriceInput] = useState("");
  const [weightInput, setWeightInput] = useState("");
  const [selectedColorIds, setSelectedColorIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isGeneratingSku, setIsGeneratingSku] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [colorSearch, setColorSearch] = useState("");
  const [uploadingColorId, setUploadingColorId] = useState<string | null>(null);
  const [isLoadingColors, setIsLoadingColors] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  const didAutoSkuRef = useRef(false);

  async function loadColors() {
    const res = await fetch("/api/colors", { cache: "no-store" });

    if (res.status === 401) {
      router.push("/login");
      return;
    }

    const json = await res.json();

    if (!res.ok) {
      throw new Error(json.error || "Erro ao listar cores");
    }

    setColors(json.colors);
  }

  useEffect(() => {
    loadColors()
      .catch((err) => setError(err.message))
      .finally(() => setIsLoadingColors(false));
  }, []);

  useEffect(() => {
    fetch("/api/auth/me", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => setIsAdmin(Boolean(json?.isAdmin)))
      .catch(() => null);
  }, []);

  useEffect(() => {
    if (!success) return;
    const timer = setTimeout(() => setSuccess(null), 7000);
    return () => clearTimeout(timer);
  }, [success]);

  useEffect(() => {
    if (didAutoSkuRef.current) return;
    if (parentSku.trim()) return;

    didAutoSkuRef.current = true;
    handleGenerateNextSku();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [parentSku]);

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

    setSelectedColorIds((prev) =>
      prev.includes(json.color.id) ? prev : [json.color.id, ...prev]
    );
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
    const color = colors.find((c) => c.id === colorId);
    const confirmed = window.confirm(
      `Excluir a cor "${color?.name ?? ""}"? Essa ação não pode ser desfeita.`
    );
    if (!confirmed) return;

    setError(null);

    const res = await fetch(`/api/colors/${colorId}`, {
      method: "DELETE"
    });

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

    setUploadingColorId(colorId);

    try {
      const res = await fetch(`/api/colors/${colorId}/image`, {
        method: "POST",
        body: form
      });

      const json = await res.json();

      if (!res.ok) {
        setError(json.error || "Erro ao subir imagem");
        return;
      }

      await loadColors();
    } finally {
      setUploadingColorId(null);
    }
  }

  const selectedColors = useMemo(
    () => colors.filter((c) => selectedColorIds.includes(c.id)),
    [colors, selectedColorIds]
  );

  const filteredColors = useMemo(() => {
    const normalize = (value: string) =>
      value
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");
    const term = normalize(colorSearch.trim());
    if (!term) return colors;
    return colors.filter((c) => normalize(`${c.name} ${c.slug}`).includes(term));
  }, [colors, colorSearch]);

  const previewSizes = useMemo(
    () =>
      sizesInput
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
    [sizesInput]
  );

  const previewVariations = useMemo(() => {
    const ordered = [...selectedColors].sort((a, b) => a.slug.localeCompare(b.slug));
    const base = parentSku.trim();
    return buildOrderedVariations(ordered, previewSizes).map(({ color, size }, index) => ({
      color,
      size,
      sku: base ? `${base}${String(index + 1).padStart(2, "0")}` : "—"
    }));
  }, [selectedColors, previewSizes, parentSku]);

  function toggleColor(colorId: string) {
    setSelectedColorIds((prev) =>
      prev.includes(colorId) ? prev.filter((id) => id !== colorId) : [...prev, colorId]
    );
  }

  function selectAllVisible() {
    setSelectedColorIds((prev) => {
      const next = new Set(prev);
      filteredColors.forEach((c) => next.add(c.id));
      return Array.from(next);
    });
  }

  function clearSelection() {
    setSelectedColorIds([]);
  }

  async function handleGenerateNextSku(): Promise<string | null> {
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

      const nextSku = String(json.sku);
      setParentSku(nextSku);
      return nextSku;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao gerar SKU");
      return null;
    } finally {
      setIsGeneratingSku(false);
    }
  }

  // Depois de exportar, já deixa o próximo SKU pronto para o próximo produto.
  // Se o banco devolver o mesmo SKU que acabou de ser usado, avisa em vermelho
  // para não sobrescrever um produto no Bling sem querer.
  async function prepareNextSkuAfterExport(usedSku: string) {
    // Avisa o contador desta pessoa qual SKU foi usado
    // (se foi digitado à mão e é maior, o contador pula para ele).
    try {
      const res = await fetch("/api/sku/used", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sku: usedSku })
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error || "Erro ao registrar o SKU usado");
      }
    } catch (err) {
      setError(
        `O arquivo foi baixado, mas não consegui atualizar o contador de SKU (${
          err instanceof Error ? err.message : "erro desconhecido"
        }). Confira o SKU antes de exportar o próximo produto.`
      );
      return;
    }

    const nextSku = await handleGenerateNextSku();
    if (!nextSku) return;

    if (nextSku === usedSku) {
      setError(
        `Atenção: o próximo SKU veio igual ao que você acabou de usar (${usedSku}). Troque o SKU antes de exportar outro produto, senão o Bling vai sobrescrever o anterior.`
      );
      return;
    }

    setSuccess((prev) =>
      prev ? `${prev} O próximo SKU (${nextSku}) já está pronto.` : prev
    );
  }

  function getValidatedExportData() {
    const trimmedProductName = productName.trim();

    if (!trimmedProductName) {
      setError("Informe o nome do produto.");
      return null;
    }

    if (!sizesInput.trim()) {
      setError("Informe os tamanhos (ex: P,M,G).");
      return null;
    }

    const skuBase = parentSku.trim();

    if (!skuBase) {
      setError("Informe o SKU do pai ou aguarde o SKU automático.");
      return null;
    }

    if (!/^\d+$/.test(skuBase)) {
      setError("SKU do pai deve ser numérico (ex: 100001)");
      return null;
    }

    const sizes = sizesInput
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    if (sizes.length === 0) {
      setError("Informe pelo menos um tamanho válido.");
      return null;
    }

    const orderedColors = [...selectedColors].sort((a, b) =>
      a.slug.localeCompare(b.slug)
    );

    if (orderedColors.length === 0) {
      setError("Selecione pelo menos uma cor.");
      return null;
    }

    return {
      trimmedProductName,
      skuBase,
      normalizedPrice: normalizeDecimal(priceInput),
      normalizedWeight: normalizeDecimal(weightInput),
      sizes,
      orderedColors
    };
  }

  function handleExport() {
    setError(null);

    const data = getValidatedExportData();
    if (!data) return;

    const {
      trimmedProductName,
      skuBase,
      normalizedPrice,
      normalizedWeight,
      sizes,
      orderedColors
    } = data;

    const parentImages = Array.from(
      new Set(
        orderedColors.map((c) => c.image_url).filter(Boolean) as string[]
      )
    );

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
        trimmedProductName,
        normalizedPrice,
        normalizedWeight,
        "",
        "pa_cor",
        orderedColors.map((c) => c.slug).join(","),
        "1",
        "1",
        "pa_tamanho",
        sizes.join(","),
        "1",
        "1",
        "",
        "",
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
        `${trimmedProductName} - ${color.name} - ${size}`,
        normalizedPrice,
        normalizedWeight,
        skuBase,
        "pa_cor",
        color.slug,
        "1",
        "1",
        "pa_tamanho",
        size,
        "1",
        "1",
        "1",
        "0",
        "",
        color.image_url || ""
      ]);
    });

    const forceQuotedColumns = new Set([1, 5]);

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

  function handleExportBling() {
    setError(null);
    setSuccess(null);

    const data = getValidatedExportData();
    if (!data) return;

    const {
      trimmedProductName,
      skuBase,
      normalizedPrice,
      normalizedWeight,
      sizes,
      orderedColors
    } = data;

    const headers = [
      "ID",
      "Código",
      "Descrição",
      "Unidade",
      "NCM",
      "Origem",
      "Preço",
      "Valor IPI fixo",
      "Observações",
      "Situação",
      "Estoque",
      "Preço de custo",
      "Cód no fornecedor",
      "Fornecedor",
      "Localização",
      "Estoque maximo",
      "Estoque minimo",
      "Peso líquido (Kg)",
      "Peso bruto (Kg)",
      "GTIN/EAN",
      "GTIN/EAN da embalagem",
      "Largura do Produto",
      "Altura do Produto",
      "Profundidade do produto",
      "Data Validade",
      "Descrição do Produto no Fornecedor",
      "Descrição Complementar",
      "Itens p/ caixa",
      "Produto Variação",
      "Tipo Produção",
      "Classe de enquadramento do IPI",
      "Código da lista de serviços",
      "Tipo do item",
      "Grupo de Tags/Tags",
      "Tributos",
      "Código Pai",
      "Código Integração",
      "Grupo de produtos",
      "Marca",
      "CEST",
      "Volumes",
      "Descrição Curta",
      "Cross-Docking",
      "URL Imagens Externas",
      "Link Externo",
      "Meses Garantia no Fornecedor",
      "Clonar dados do pai",
      "Condição do produto",
      "Frete Grátis",
      "Número FCI",
      "Vídeo",
      "Departamento",
      "Unidade de medida",
      "Preço de compra",
      "Valor base ICMS ST para retenção",
      "Valor ICMS ST para retenção",
      "Valor ICMS próprio do substituto",
      "Categoria do produto",
      "Informações Adicionais"
    ];

    function makeBlingRow(values: Partial<Record<(typeof headers)[number], string>>) {
      return headers.map((header) => values[header] || "");
    }

    const rows: string[][] = [];

    rows.push(
      makeBlingRow({
        Código: skuBase,
        Descrição: trimmedProductName,
        Unidade: "UN",
        Origem: "0",
        Preço: normalizedPrice,
        Situação: "Ativo",
        Estoque: "0",
        "Peso líquido (Kg)": normalizedWeight,
        "Peso bruto (Kg)": normalizedWeight,
        "Produto Variação": "",
        "Tipo Produção": "P",
        "Tipo do item": "Mercadoria para Revenda",
        "Clonar dados do pai": "NÃO",
        "URL Imagens Externas": orderedColors.find((c) => c.image_url)?.image_url || ""
      })
    );

    const orderedVariations = buildOrderedVariations(orderedColors, sizes);

    orderedVariations.forEach(({ color, size }, index) => {
      const suffix = String(index + 1).padStart(2, "0");
      const childSku = `${skuBase}${suffix}`;

      rows.push(
        makeBlingRow({
          Código: childSku,
          Descrição: `Cor:${color.name};Tamanho:${size}`,
          Unidade: "UN",
          Origem: "0",
          Preço: normalizedPrice,
          Situação: "Ativo",
          Estoque: "0",
          "Peso líquido (Kg)": normalizedWeight,
          "Peso bruto (Kg)": normalizedWeight,
          "Produto Variação": "Produto",
          "Tipo Produção": "P",
          "Tipo do item": "Mercadoria para Revenda",
          "Código Pai": skuBase,
          "Clonar dados do pai": "NÃO",
          "URL Imagens Externas": color.image_url || ""
        })
      );
    });

    const csv = [headers, ...rows]
      .map((line) => line.map((v) => escapeCsv(v)).join(","))
      .join("\n");

    downloadCsv("bling-import.csv", csv);
    setSuccess(
      `Pronto! O arquivo bling-import.csv foi baixado com ${orderedVariations.length} variações. Agora é só importar no Bling.`
    );

    void prepareNextSkuAfterExport(skuBase);
  }

  const variationCount = previewVariations.length;
  const previewLimit = 8;

  return (
    <main className={styles.page}>
      <header className={styles.topbar}>
        <div className={styles.topbarInner}>
          <div className={styles.brand}>
            <Image
              src="/Ellos-Escrito-Logo-Preto.png"
              alt="Ellos"
              width={260}
              height={80}
              className={styles.logo}
              priority
            />
            <span className={styles.brandDivider} aria-hidden="true" />
            <span className={styles.brandTitle}>Cadastro de Produtos</span>
          </div>

          <nav className={styles.topbarActions}>
            {isAdmin ? (
              <Link className={`${styles.btn} ${styles.btnGhost}`} href="/usuarios">
                Usuários
              </Link>
            ) : null}
            <button
              className={`${styles.btn} ${styles.btnGhost}`}
              type="button"
              onClick={handleLogout}
            >
              Sair
            </button>
          </nav>
        </div>
      </header>

      <div className={styles.shell}>
        <section className={styles.intro}>
          <h1>Olá! Vamos cadastrar um produto?</h1>
          <p>
            Escolha as cores, preencha os dados e baixe o arquivo pronto para importar no Bling.
          </p>
        </section>

        <div className={styles.grid}>
          {/* PASSO 1 — CORES */}
          <section className={styles.card}>
            <div className={styles.stepHeader}>
              <span className={styles.stepNumber}>1</span>
              <div>
                <h2>Escolha as cores</h2>
                <p className={styles.stepHint}>Clique na cor para selecionar ou tirar.</p>
              </div>
              <span className={styles.pill}>
                {selectedColors.length} de {colors.length} selecionadas
              </span>
            </div>

            <div className={styles.toolbar}>
              <input
                className={`${styles.input} ${styles.searchInput}`}
                value={colorSearch}
                onChange={(e) => setColorSearch(e.target.value)}
                placeholder="Buscar cor…"
                aria-label="Buscar cor"
              />
              <button
                className={`${styles.btn} ${styles.btnMuted} ${styles.btnSmall}`}
                type="button"
                onClick={selectAllVisible}
                disabled={filteredColors.length === 0}
              >
                Selecionar todas
              </button>
              <button
                className={`${styles.btn} ${styles.btnMuted} ${styles.btnSmall}`}
                type="button"
                onClick={clearSelection}
                disabled={selectedColorIds.length === 0}
              >
                Limpar
              </button>
            </div>

            {isLoadingColors ? (
              <div className={styles.emptyState}>Carregando cores…</div>
            ) : colors.length === 0 ? (
              <div className={styles.emptyState}>
                Nenhuma cor cadastrada ainda. Adicione a primeira logo abaixo.
              </div>
            ) : filteredColors.length === 0 ? (
              <div className={styles.emptyState}>
                Nenhuma cor encontrada para “{colorSearch}”.
              </div>
            ) : (
              <div className={styles.colorGrid}>
                {filteredColors.map((color) => {
                  const isSelected = selectedColorIds.includes(color.id);
                  const isUploading = uploadingColorId === color.id;

                  return (
                    <article
                      key={color.id}
                      className={`${styles.colorTile} ${isSelected ? styles.colorTileSelected : ""} ${
                        editingColorId === color.id ? styles.colorTileEditing : ""
                      }`}
                    >
                      <button
                        type="button"
                        className={styles.colorSelect}
                        onClick={() => toggleColor(color.id)}
                        aria-pressed={isSelected}
                        title={isSelected ? "Clique para tirar" : "Clique para selecionar"}
                      >
                        <span className={styles.colorThumb}>
                          {color.image_url ? (
                            <img src={color.image_url} alt={`Foto da cor ${color.name}`} loading="lazy" />
                          ) : (
                            <span className={styles.noPhoto}>sem foto</span>
                          )}
                          {isUploading ? <span className={styles.uploading}>Enviando…</span> : null}
                        </span>
                        <span className={styles.check} aria-hidden="true">
                          ✓
                        </span>
                        <span className={styles.colorName}>{color.name}</span>
                        <span className={styles.colorSlug}>{color.slug}</span>
                      </button>

                      <div className={styles.tileActions}>
                        <label className={styles.tileAction} title="Enviar ou trocar a foto">
                          {color.image_url ? "Foto" : "+ Foto"}
                          <input
                            type="file"
                            accept="image/*"
                            className={styles.hiddenFile}
                            disabled={isUploading}
                            onChange={(e) => {
                              handleUpload(color.id, e.target.files?.[0] || null);
                              e.target.value = "";
                            }}
                          />
                        </label>
                        <button
                          type="button"
                          className={styles.tileAction}
                          onClick={() => startEdit(color)}
                        >
                          Editar
                        </button>
                        <button
                          type="button"
                          className={`${styles.tileAction} ${styles.tileActionDanger}`}
                          onClick={() => handleDeleteColor(color.id)}
                        >
                          Excluir
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}

            <form
              onSubmit={editingColorId ? handleUpdateColor : handleCreateColor}
              className={styles.newColor}
            >
              <h3>{editingColorId ? "Editar cor" : "Adicionar nova cor"}</h3>

              <div className={styles.newColorFields}>
                <label className={styles.label}>
                  Nome da cor
                  <input
                    className={styles.input}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Ex: Azul Marinho"
                    required
                  />
                </label>

                <label className={styles.label}>
                  <span>
                    Slug <span className={styles.optional}>(opcional)</span>
                  </span>
                  <input
                    className={styles.input}
                    value={slug}
                    onChange={(e) => setSlug(e.target.value)}
                    placeholder="Gerado automaticamente"
                  />
                </label>
              </div>

              <div className={styles.buttonRow}>
                <button className={`${styles.btn} ${styles.btnPrimary}`} type="submit">
                  {editingColorId ? "Salvar alterações" : "+ Adicionar cor"}
                </button>

                {editingColorId ? (
                  <button
                    className={`${styles.btn} ${styles.btnMuted}`}
                    type="button"
                    onClick={cancelEdit}
                  >
                    Cancelar
                  </button>
                ) : null}
              </div>
              <p className={styles.fieldHint}>
                O slug é o “apelido” da cor (ex: azul-marinho). Ele define a ordem das variações.
              </p>
            </form>
          </section>

          <div className={styles.sideColumn}>
            {/* PASSO 2 — DADOS */}
            <section className={styles.card}>
              <div className={styles.stepHeader}>
                <span className={styles.stepNumber}>2</span>
                <div>
                  <h2>Dados do produto</h2>
                  <p className={styles.stepHint}>Preço e peso valem para todas as variações.</p>
                </div>
              </div>

              <div className={styles.formGrid}>
                <label className={styles.label}>
                  Nome do produto
                  <input
                    className={styles.input}
                    value={productName}
                    onChange={(e) => setProductName(e.target.value)}
                    placeholder="Ex: Camiseta Lisa Premium"
                  />
                </label>

                <label className={styles.label}>
                  SKU do pai
                  <div className={styles.skuRow}>
                    <input
                      className={styles.input}
                      value={parentSku}
                      onChange={(e) => setParentSku(e.target.value)}
                      placeholder="Gerado automaticamente"
                      inputMode="numeric"
                    />
                    <button
                      className={`${styles.btn} ${styles.btnMuted}`}
                      type="button"
                      onClick={handleGenerateNextSku}
                      disabled={isGeneratingSku}
                    >
                      {isGeneratingSku ? "Gerando…" : "↻ Gerar próximo"}
                    </button>
                  </div>
                </label>

                <div className={styles.label}>
                  <label htmlFor="sizes-input">Tamanhos</label>
                  <input
                    id="sizes-input"
                    className={styles.input}
                    value={sizesInput}
                    onChange={(e) => setSizesInput(e.target.value)}
                    placeholder="Separe por vírgula: P,M,G"
                  />
                  <div className={styles.presets}>
                    {SIZE_PRESETS.map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        className={`${styles.preset} ${sizesInput === preset ? styles.presetActive : ""}`}
                        onClick={() => setSizesInput(preset)}
                      >
                        {preset === "U" ? "Tamanho único" : preset.replace(/,/g, " · ")}
                      </button>
                    ))}
                  </div>
                </div>

                <div className={styles.twoCols}>
                  <label className={styles.label}>
                    Preço
                    <span className={styles.affixInput}>
                      <span className={styles.affix}>R$</span>
                      <input
                        className={styles.input}
                        value={priceInput}
                        onChange={(e) => setPriceInput(e.target.value)}
                        placeholder="79,90"
                        inputMode="decimal"
                      />
                    </span>
                  </label>

                  <label className={styles.label}>
                    Peso
                    <span className={styles.affixInput}>
                      <input
                        className={styles.input}
                        value={weightInput}
                        onChange={(e) => setWeightInput(e.target.value)}
                        placeholder="0,25"
                        inputMode="decimal"
                      />
                      <span className={styles.affix}>kg</span>
                    </span>
                  </label>
                </div>
              </div>
            </section>

            {/* PASSO 3 — EXPORTAR */}
            <section className={styles.card}>
              <div className={styles.stepHeader}>
                <span className={styles.stepNumber}>3</span>
                <div>
                  <h2>Revise e exporte</h2>
                  <p className={styles.stepHint}>Confira as variações antes de baixar.</p>
                </div>
              </div>

              <div className={styles.summary}>
                <div className={styles.summaryItem}>
                  <span>Cores</span>
                  <strong>{selectedColors.length}</strong>
                </div>
                <span className={styles.summaryOp}>×</span>
                <div className={styles.summaryItem}>
                  <span>Tamanhos</span>
                  <strong>{previewSizes.length}</strong>
                </div>
                <span className={styles.summaryOp}>=</span>
                <div className={`${styles.summaryItem} ${styles.summaryTotal}`}>
                  <span>Variações</span>
                  <strong>{variationCount}</strong>
                </div>
              </div>

              {variationCount > 0 ? (
                <ul className={styles.variationList}>
                  {previewVariations.slice(0, previewLimit).map((v) => (
                    <li key={`${v.color.id}-${v.size}`}>
                      <span className={styles.variationSku}>{v.sku}</span>
                      <span>
                        {v.color.name} · {v.size}
                      </span>
                    </li>
                  ))}
                  {variationCount > previewLimit ? (
                    <li className={styles.variationMore}>
                      e mais {variationCount - previewLimit} variações…
                    </li>
                  ) : null}
                </ul>
              ) : (
                <p className={styles.fieldHint}>
                  Selecione pelo menos uma cor e um tamanho para ver as variações aqui.
                </p>
              )}

              <button
                className={`${styles.btn} ${styles.btnPrimary} ${styles.btnBig}`}
                type="button"
                onClick={handleExportBling}
              >
                ⬇ Baixar arquivo para o Bling
              </button>
              <p className={styles.fieldHint}>
                Depois de baixar, o próximo SKU já é gerado sozinho. SKU de cada variação = SKU do
                pai + 2 dígitos (ex: 100001 → 10000101).
              </p>
            </section>
          </div>
        </div>
      </div>

      <div className={styles.toasts} aria-live="polite">
        {error ? (
          <div className={`${styles.toast} ${styles.toastError}`} role="alert">
            <span>{error}</span>
            <button type="button" onClick={() => setError(null)} aria-label="Fechar aviso">
              ×
            </button>
          </div>
        ) : null}
        {success ? (
          <div className={`${styles.toast} ${styles.toastSuccess}`}>
            <span>{success}</span>
            <button type="button" onClick={() => setSuccess(null)} aria-label="Fechar aviso">
              ×
            </button>
          </div>
        ) : null}
      </div>
    </main>
  );
}

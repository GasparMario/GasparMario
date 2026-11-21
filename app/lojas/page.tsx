"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import styles from "../admin/admin.module.css";
import own from "../usuarios/usuarios.module.css";
import lojas from "./lojas.module.css";

type StoreRow = {
  id: string;
  name: string;
  memberIds: string[];
  nextSku: string | null;
  blingConnectedAt: string | null;
};

type UserRow = { id: string; name: string; email: string; isAdmin: boolean };

const BLING_MESSAGES: Record<string, { ok: boolean; text: string }> = {
  conectado: { ok: true, text: "Bling conectado à loja!" },
  cancelado: { ok: false, text: "A conexão com o Bling foi cancelada." },
  "erro-state": {
    ok: false,
    text: "Não deu para confirmar a conexão. Abra o sistema pelo endereço oficial e tente de novo."
  },
  "nao-configurado": {
    ok: false,
    text: "As chaves do aplicativo Bling ainda não foram cadastradas na Vercel."
  },
  "so-admin": { ok: false, text: "Só administradores podem conectar o Bling de uma loja." },
  "loja-invalida": { ok: false, text: "Loja não encontrada. Atualize a página e tente de novo." },
  erro: { ok: false, text: "O Bling não completou a conexão. Tente de novo em alguns minutos." }
};

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  });
}

export default function StoresPage() {
  const router = useRouter();
  const [stores, setStores] = useState<StoreRow[]>([]);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [blingConfigured, setBlingConfigured] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [notAllowed, setNotAllowed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [newName, setNewName] = useState("");
  const [newStartSku, setNewStartSku] = useState("");
  const [newMembers, setNewMembers] = useState<string[]>([]);
  const [isCreating, setIsCreating] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState("");
  const [draftSku, setDraftSku] = useState("");
  const [draftMembers, setDraftMembers] = useState<string[]>([]);

  async function load() {
    const res = await fetch("/api/admin/stores", { cache: "no-store" });
    if (res.status === 401) {
      router.push("/login");
      return;
    }
    if (res.status === 403) {
      setNotAllowed(true);
      return;
    }
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "Erro ao carregar lojas");
    setStores(json.stores);
    setUsers(json.users);
    setBlingConfigured(Boolean(json.blingConfigured));
  }

  useEffect(() => {
    load()
      .catch((err) => setError(err.message))
      .finally(() => setIsLoading(false));

    const params = new URLSearchParams(window.location.search);
    const result = params.get("bling");
    if (result) {
      const message = BLING_MESSAGES[result] ?? BLING_MESSAGES.erro;
      if (message.ok) setSuccess(message.text);
      else setError(message.text);
      window.history.replaceState(null, "", window.location.pathname);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!success) return;
    const timer = setTimeout(() => setSuccess(null), 7000);
    return () => clearTimeout(timer);
  }, [success]);

  function toggle(list: string[], id: string) {
    return list.includes(id) ? list.filter((x) => x !== id) : [...list, id];
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setIsCreating(true);
    try {
      const res = await fetch("/api/admin/stores", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName, startSku: newStartSku, memberIds: newMembers })
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || "Erro ao criar loja");
        return;
      }
      setSuccess(`Loja "${json.store.name}" criada. Agora conecte o Bling dela.`);
      setNewName("");
      setNewStartSku("");
      setNewMembers([]);
      await load();
    } finally {
      setIsCreating(false);
    }
  }

  function startEdit(store: StoreRow) {
    setEditingId(store.id);
    setDraftName(store.name);
    setDraftSku(store.nextSku || "");
    setDraftMembers(store.memberIds);
  }

  async function handleSave(store: StoreRow) {
    setError(null);
    const body: { name?: string; memberIds: string[]; nextSku?: string } = {
      memberIds: draftMembers
    };
    if (draftName.trim() !== store.name) body.name = draftName;
    if (draftSku.trim() && draftSku.trim() !== (store.nextSku || "")) {
      if (!/^\d+$/.test(draftSku.trim())) {
        setError("O SKU precisa ser só números (ex: 100001).");
        return;
      }
      body.nextSku = draftSku.trim();
    }

    const res = await fetch(`/api/admin/stores/${store.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    const json = await res.json();
    if (!res.ok) {
      setError(json.error || "Erro ao salvar loja");
      return;
    }
    setEditingId(null);
    setSuccess(`Loja "${draftName.trim() || store.name}" atualizada.`);
    await load();
  }

  async function handleDisconnect(store: StoreRow) {
    const confirmed = window.confirm(
      `Desconectar o Bling da loja "${store.name}"? Dá para conectar de novo quando quiser.`
    );
    if (!confirmed) return;
    const res = await fetch("/api/bling/disconnect", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ storeId: store.id })
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(json.error || "Erro ao desconectar");
      return;
    }
    setSuccess(`Bling da loja "${store.name}" desconectado.`);
    await load();
  }

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => null);
    router.push("/login");
  }

  const userLabel = (u: UserRow) => u.name || u.email;

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
            <span className={styles.brandTitle}>Lojas</span>
          </div>

          <nav className={styles.topbarActions}>
            <Link className={`${styles.btn} ${styles.btnGhost}`} href="/admin">
              ← Voltar ao cadastro
            </Link>
            <Link className={`${styles.btn} ${styles.btnGhost}`} href="/usuarios">
              Usuários
            </Link>
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

      <div className={`${styles.shell} ${own.narrow}`}>
        {notAllowed ? (
          <section className={styles.card}>
            <div className={styles.emptyState}>
              Só administradores podem ver e gerenciar as lojas.
              <br />
              <Link href="/admin" className={own.backLink}>
                Voltar ao cadastro
              </Link>
            </div>
          </section>
        ) : (
          <>
            <section className={styles.intro}>
              <h1>Lojas</h1>
              <p>
                Cada loja tem o próprio Bling, as próprias cores e a própria sequência de SKU.
                Escolha quem da equipe trabalha em cada uma.
              </p>
            </section>

            <div className={own.stack}>
              <section className={styles.card}>
                <div className={styles.stepHeader}>
                  <span className={styles.stepNumber}>{stores.length}</span>
                  <div>
                    <h2>Suas lojas</h2>
                    <p className={styles.stepHint}>
                      Administradores enxergam todas. Os outros usuários veem só as lojas marcadas
                      para eles.
                    </p>
                  </div>
                </div>

                {isLoading ? (
                  <div className={styles.emptyState}>Carregando lojas…</div>
                ) : stores.length === 0 ? (
                  <div className={styles.emptyState}>Nenhuma loja ainda. Crie a primeira abaixo.</div>
                ) : (
                  <div className={lojas.ljList}>
                    {stores.map((store) => {
                      const isEditing = editingId === store.id;
                      const members = users.filter((u) => store.memberIds.includes(u.id));

                      return (
                        <article key={store.id} className={lojas.ljStore}>
                          <div className={lojas.ljStoreHead}>
                            {isEditing ? (
                              <input
                                className={styles.input}
                                value={draftName}
                                onChange={(e) => setDraftName(e.target.value)}
                                aria-label="Nome da loja"
                              />
                            ) : (
                              <h3>{store.name}</h3>
                            )}
                            {!isEditing ? (
                              <button
                                type="button"
                                className={`${styles.btn} ${styles.btnMuted} ${styles.btnSmall}`}
                                onClick={() => startEdit(store)}
                              >
                                Editar
                              </button>
                            ) : null}
                          </div>

                          <div className={lojas.ljRows}>
                            <div className={lojas.ljRow}>
                              <span className={lojas.ljRowLabel}>Bling</span>
                              {store.blingConnectedAt ? (
                                <span className={lojas.ljRowValue}>
                                  <span className={styles.blingDot} aria-hidden="true" />
                                  Conectado desde {formatDate(store.blingConnectedAt)}
                                  <button
                                    type="button"
                                    className={styles.blingLink}
                                    onClick={() => handleDisconnect(store)}
                                  >
                                    Desconectar
                                  </button>
                                </span>
                              ) : blingConfigured ? (
                                <span className={lojas.ljRowValue}>
                                  <span className={lojas.ljMuted}>Não conectado</span>
                                  <a
                                    className={`${styles.btn} ${styles.btnPrimary} ${styles.btnSmall} ${lojas.ljLinkBtn}`}
                                    href={`/api/bling/connect?store=${encodeURIComponent(store.id)}&back=lojas`}
                                  >
                                    Conectar Bling
                                  </a>
                                </span>
                              ) : (
                                <span className={lojas.ljMuted}>
                                  Chaves do Bling não cadastradas na Vercel
                                </span>
                              )}
                            </div>

                            <div className={lojas.ljRow}>
                              <span className={lojas.ljRowLabel}>Próximo SKU</span>
                              {isEditing ? (
                                <input
                                  className={`${styles.input} ${lojas.ljSkuInput}`}
                                  value={draftSku}
                                  onChange={(e) => setDraftSku(e.target.value)}
                                  placeholder="100001"
                                  inputMode="numeric"
                                />
                              ) : (
                                <span className={lojas.ljMono}>{store.nextSku ?? "100001 (padrão)"}</span>
                              )}
                            </div>

                            <div className={lojas.ljRow}>
                              <span className={lojas.ljRowLabel}>Quem usa</span>
                              {isEditing ? (
                                <div className={lojas.ljChecks}>
                                  {users.map((u) => (
                                    <label key={u.id} className={lojas.ljCheck}>
                                      <input
                                        type="checkbox"
                                        checked={draftMembers.includes(u.id) || u.isAdmin}
                                        disabled={u.isAdmin}
                                        onChange={() => setDraftMembers((m) => toggle(m, u.id))}
                                      />
                                      {userLabel(u)}
                                      {u.isAdmin ? <em>admin, vê todas</em> : null}
                                    </label>
                                  ))}
                                </div>
                              ) : (
                                <span className={lojas.ljRowValue}>
                                  {members.filter((u) => !u.isAdmin).length === 0 ? (
                                    <span className={lojas.ljMuted}>Só administradores</span>
                                  ) : (
                                    members
                                      .filter((u) => !u.isAdmin)
                                      .map((u) => (
                                        <span key={u.id} className={lojas.ljChip}>
                                          {userLabel(u)}
                                        </span>
                                      ))
                                  )}
                                </span>
                              )}
                            </div>
                          </div>

                          {isEditing ? (
                            <div className={styles.buttonRow}>
                              <button
                                type="button"
                                className={`${styles.btn} ${styles.btnPrimary} ${styles.btnSmall}`}
                                onClick={() => handleSave(store)}
                              >
                                Salvar
                              </button>
                              <button
                                type="button"
                                className={`${styles.btn} ${styles.btnMuted} ${styles.btnSmall}`}
                                onClick={() => setEditingId(null)}
                              >
                                Cancelar
                              </button>
                            </div>
                          ) : null}
                        </article>
                      );
                    })}
                  </div>
                )}
              </section>

              <section className={styles.card}>
                <div className={styles.stepHeader}>
                  <span className={styles.stepNumber}>+</span>
                  <div>
                    <h2>Nova loja</h2>
                    <p className={styles.stepHint}>
                      Depois de criar, clique em Conectar Bling e entre no Bling dessa loja.
                    </p>
                  </div>
                </div>

                <form className={styles.formGrid} onSubmit={handleCreate}>
                  <div className={styles.twoCols}>
                    <label className={styles.label}>
                      Nome da loja
                      <input
                        className={styles.input}
                        value={newName}
                        onChange={(e) => setNewName(e.target.value)}
                        placeholder="Ex: Falcon"
                        required
                      />
                    </label>
                    <label className={styles.label}>
                      <span>
                        SKU inicial <span className={styles.optional}>(opcional)</span>
                      </span>
                      <input
                        className={styles.input}
                        value={newStartSku}
                        onChange={(e) => setNewStartSku(e.target.value)}
                        placeholder="100001"
                        inputMode="numeric"
                      />
                    </label>
                  </div>

                  <div className={styles.label}>
                    Quem usa esta loja
                    <div className={lojas.ljChecks}>
                      {users.filter((u) => !u.isAdmin).length === 0 ? (
                        <span className={lojas.ljMuted}>
                          Nenhum usuário comum ainda. Crie na página Usuários.
                        </span>
                      ) : (
                        users
                          .filter((u) => !u.isAdmin)
                          .map((u) => (
                            <label key={u.id} className={lojas.ljCheck}>
                              <input
                                type="checkbox"
                                checked={newMembers.includes(u.id)}
                                onChange={() => setNewMembers((m) => toggle(m, u.id))}
                              />
                              {userLabel(u)}
                            </label>
                          ))
                      )}
                    </div>
                  </div>

                  <div className={styles.buttonRow}>
                    <button
                      className={`${styles.btn} ${styles.btnPrimary}`}
                      type="submit"
                      disabled={isCreating}
                    >
                      {isCreating ? "Criando…" : "Criar loja"}
                    </button>
                  </div>
                  <p className={styles.fieldHint}>
                    SKU inicial: o primeiro SKU dessa loja no Bling dela. Se deixar em branco,
                    começa em 100001. Dá para mudar depois.
                  </p>
                </form>
              </section>
            </div>
          </>
        )}
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

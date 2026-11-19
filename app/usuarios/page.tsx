"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import styles from "../admin/admin.module.css";
import own from "./usuarios.module.css";

type AppUser = {
  id: string;
  email: string;
  name: string;
  createdAt: string;
  lastSignInAt: string | null;
  isAdmin: boolean;
  isOwner: boolean;
  nextSku: string | null;
};

type Me = { uid: string; isAdmin: boolean };

function formatDate(value: string | null) {
  if (!value) return "nunca entrou";
  return new Date(value).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

export default function UsersPage() {
  const router = useRouter();
  const [users, setUsers] = useState<AppUser[]>([]);
  const [me, setMe] = useState<Me | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [startSku, setStartSku] = useState("");
  const [newIsAdmin, setNewIsAdmin] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editingSkuId, setEditingSkuId] = useState<string | null>(null);
  const [skuDraft, setSkuDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function loadUsers() {
    const res = await fetch("/api/users", { cache: "no-store" });
    if (res.status === 401) {
      router.push("/login");
      return;
    }
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "Erro ao listar usuários");
    setUsers(json.users);
  }

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/auth/me", { cache: "no-store" });
        if (res.status === 401) {
          router.push("/login");
          return;
        }
        const json = await res.json();
        const current: Me = { uid: json.uid, isAdmin: Boolean(json.isAdmin) };
        setMe(current);
        if (current.isAdmin) await loadUsers();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erro ao carregar");
      } finally {
        setIsLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!success) return;
    const timer = setTimeout(() => setSuccess(null), 7000);
    return () => clearTimeout(timer);
  }, [success]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setIsSaving(true);

    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password, startSku, isAdmin: newIsAdmin })
      });
      const json = await res.json();

      if (!res.ok) {
        setError(json.error || "Erro ao criar usuário");
        return;
      }

      setSuccess(
        `Acesso criado para ${json.user.email}. Passe o e-mail e a senha para a pessoa entrar.`
      );
      setName("");
      setEmail("");
      setPassword("");
      setStartSku("");
      setNewIsAdmin(false);
      await loadUsers();
    } catch {
      setError("Não foi possível conectar. Tente de novo.");
    } finally {
      setIsSaving(false);
    }
  }

  async function patchUser(user: AppUser, body: { isAdmin?: boolean; nextSku?: string }) {
    setError(null);
    const res = await fetch(`/api/users/${user.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    const json = await res.json();
    if (!res.ok) {
      setError(json.error || "Erro ao alterar usuário");
      return false;
    }
    await loadUsers();
    return true;
  }

  async function handleToggleAdmin(user: AppUser) {
    const becomingAdmin = !user.isAdmin;
    const who = user.name || user.email;
    const confirmed = window.confirm(
      becomingAdmin
        ? `Tornar ${who} administrador? Essa pessoa vai poder criar e remover acessos.`
        : `Tirar o acesso de administrador de ${who}?`
    );
    if (!confirmed) return;

    if (await patchUser(user, { isAdmin: becomingAdmin })) {
      setSuccess(
        becomingAdmin ? `${who} agora é administrador.` : `${who} não é mais administrador.`
      );
    }
  }

  function startEditSku(user: AppUser) {
    setEditingSkuId(user.id);
    setSkuDraft(user.nextSku || "");
  }

  async function handleSaveSku(user: AppUser) {
    if (!/^\d+$/.test(skuDraft.trim())) {
      setError("O SKU precisa ser só números (ex: 100001).");
      return;
    }
    if (await patchUser(user, { nextSku: skuDraft.trim() })) {
      setEditingSkuId(null);
      setSuccess(`O próximo SKU de ${user.name || user.email} será ${skuDraft.trim()}.`);
    }
  }

  async function handleDelete(user: AppUser) {
    const confirmed = window.confirm(
      `Remover o acesso de ${user.name || user.email}? A pessoa não vai mais conseguir entrar.`
    );
    if (!confirmed) return;

    setError(null);
    const res = await fetch(`/api/users/${user.id}`, { method: "DELETE" });
    const json = await res.json();

    if (!res.ok) {
      setError(json.error || "Erro ao remover usuário");
      return;
    }

    setSuccess(`Acesso de ${user.email} removido.`);
    await loadUsers();
  }

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => null);
    router.push("/login");
  }

  const notAllowed = !isLoading && me && !me.isAdmin;

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
            <span className={styles.brandTitle}>Usuários</span>
          </div>

          <nav className={styles.topbarActions}>
            <Link className={`${styles.btn} ${styles.btnGhost}`} href="/admin">
              ← Voltar ao cadastro
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
              Só administradores podem ver e criar usuários.
              <br />
              <Link href="/admin" className={own.backLink}>
                Voltar ao cadastro
              </Link>
            </div>
          </section>
        ) : (
          <>
            <section className={styles.intro}>
              <h1>Quem pode usar o sistema</h1>
              <p>
                Crie um acesso para cada pessoa. Cada uma vê só as próprias cores e tem a própria
                sequência de SKU.
              </p>
            </section>

            <div className={own.stack}>
              <section className={styles.card}>
                <div className={styles.stepHeader}>
                  <span className={styles.stepNumber}>+</span>
                  <div>
                    <h2>Novo usuário</h2>
                    <p className={styles.stepHint}>A pessoa já pode entrar logo depois de criado.</p>
                  </div>
                </div>

                <form className={styles.formGrid} onSubmit={handleCreate}>
                  <div className={styles.twoCols}>
                    <label className={styles.label}>
                      <span>
                        Nome <span className={styles.optional}>(opcional)</span>
                      </span>
                      <input
                        className={styles.input}
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Ex: Loja Falcon"
                      />
                    </label>

                    <label className={styles.label}>
                      E-mail
                      <input
                        className={styles.input}
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="pessoa@exemplo.com"
                        autoComplete="off"
                        required
                      />
                    </label>
                  </div>

                  <div className={styles.twoCols}>
                    <label className={styles.label}>
                      Senha inicial
                      <input
                        className={styles.input}
                        type="text"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Pelo menos 8 caracteres"
                        autoComplete="new-password"
                        required
                      />
                    </label>

                    <label className={styles.label}>
                      <span>
                        SKU inicial <span className={styles.optional}>(opcional)</span>
                      </span>
                      <input
                        className={styles.input}
                        value={startSku}
                        onChange={(e) => setStartSku(e.target.value)}
                        placeholder="100001"
                        inputMode="numeric"
                      />
                    </label>
                  </div>

                  <label className={own.checkRow}>
                    <input
                      type="checkbox"
                      checked={newIsAdmin}
                      onChange={(e) => setNewIsAdmin(e.target.checked)}
                    />
                    <span>
                      <strong>Administrador</strong>
                      <span>Pode ver esta página, criar e remover acessos.</span>
                    </span>
                  </label>

                  <div className={styles.buttonRow}>
                    <button
                      className={`${styles.btn} ${styles.btnPrimary}`}
                      type="submit"
                      disabled={isSaving}
                    >
                      {isSaving ? "Criando…" : "Criar acesso"}
                    </button>
                  </div>
                  <p className={styles.fieldHint}>
                    SKU inicial: o primeiro SKU que essa pessoa vai usar no Bling dela. Se deixar em
                    branco, começa em 100001. Dá para mudar depois.
                  </p>
                </form>
              </section>

              <section className={styles.card}>
                <div className={styles.stepHeader}>
                  <span className={styles.stepNumber}>{users.length}</span>
                  <div>
                    <h2>Usuários com acesso</h2>
                    <p className={styles.stepHint}>
                      Ajuste o próximo SKU, dê poder de administrador ou remova quem não deve mais
                      entrar.
                    </p>
                  </div>
                </div>

                {isLoading ? (
                  <div className={styles.emptyState}>Carregando usuários…</div>
                ) : users.length === 0 ? (
                  <div className={styles.emptyState}>Nenhum usuário encontrado.</div>
                ) : (
                  <ul className={own.userList}>
                    {users.map((user) => {
                      const isMe = user.id === me?.uid;
                      const initial = (user.name || user.email).trim().charAt(0).toUpperCase();
                      const isEditingSku = editingSkuId === user.id;

                      return (
                        <li key={user.id} className={own.userRow}>
                          <span className={own.avatar} aria-hidden="true">
                            {initial}
                          </span>
                          <div className={own.userInfo}>
                            <strong>
                              {user.name || user.email}
                              {user.isOwner ? (
                                <span className={own.tag}>dono</span>
                              ) : user.isAdmin ? (
                                <span className={own.tag}>admin</span>
                              ) : null}
                              {isMe ? <span className={own.tagLight}>você</span> : null}
                            </strong>
                            {user.name ? <span>{user.email}</span> : null}

                            {isEditingSku ? (
                              <span className={own.skuEdit}>
                                Próximo SKU:
                                <input
                                  className={own.skuInput}
                                  value={skuDraft}
                                  onChange={(e) => setSkuDraft(e.target.value)}
                                  inputMode="numeric"
                                  autoFocus
                                />
                                <button
                                  type="button"
                                  className={own.linkBtn}
                                  onClick={() => handleSaveSku(user)}
                                >
                                  Salvar
                                </button>
                                <button
                                  type="button"
                                  className={own.linkBtnMuted}
                                  onClick={() => setEditingSkuId(null)}
                                >
                                  Cancelar
                                </button>
                              </span>
                            ) : (
                              <span className={own.skuLine}>
                                Próximo SKU: <b>{user.nextSku ?? "100001 (padrão)"}</b>
                                <button
                                  type="button"
                                  className={own.linkBtn}
                                  onClick={() => startEditSku(user)}
                                >
                                  Alterar
                                </button>
                              </span>
                            )}

                            <span className={own.lastSeen}>
                              Último acesso: {formatDate(user.lastSignInAt)}
                            </span>
                          </div>

                          {isMe || user.isOwner ? null : (
                            <div className={own.rowActions}>
                              <button
                                type="button"
                                className={`${styles.btn} ${styles.btnSmall} ${styles.btnMuted}`}
                                onClick={() => handleToggleAdmin(user)}
                              >
                                {user.isAdmin ? "Tirar admin" : "Tornar admin"}
                              </button>
                              <button
                                type="button"
                                className={`${styles.btn} ${styles.btnSmall} ${own.removeBtn}`}
                                onClick={() => handleDelete(user)}
                              >
                                Remover
                              </button>
                            </div>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}
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

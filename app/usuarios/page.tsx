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
};

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
  const [me, setMe] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSaving, setIsSaving] = useState(false);
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
    fetch("/api/auth/me", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => setMe(json?.uid ?? null))
      .catch(() => null);

    loadUsers()
      .catch((err) => setError(err.message))
      .finally(() => setIsLoading(false));
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
        body: JSON.stringify({ name, email, password })
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
      await loadUsers();
    } catch {
      setError("Não foi possível conectar. Tente de novo.");
    } finally {
      setIsSaving(false);
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
        <section className={styles.intro}>
          <h1>Quem pode usar o sistema</h1>
          <p>Crie um acesso para cada pessoa da equipe. Cada um entra com seu próprio e-mail e senha.</p>
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
                    placeholder="Ex: Gabriel"
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

              <div className={styles.buttonRow}>
                <button
                  className={`${styles.btn} ${styles.btnPrimary}`}
                  type="submit"
                  disabled={isSaving}
                >
                  {isSaving ? "Criando…" : "Criar acesso"}
                </button>
              </div>
            </form>
          </section>

          <section className={styles.card}>
            <div className={styles.stepHeader}>
              <span className={styles.stepNumber}>{users.length}</span>
              <div>
                <h2>Usuários com acesso</h2>
                <p className={styles.stepHint}>Remova quem não deve mais entrar no sistema.</p>
              </div>
            </div>

            {isLoading ? (
              <div className={styles.emptyState}>Carregando usuários…</div>
            ) : users.length === 0 ? (
              <div className={styles.emptyState}>Nenhum usuário encontrado.</div>
            ) : (
              <ul className={own.userList}>
                {users.map((user) => {
                  const isMe = user.id === me;
                  const initial = (user.name || user.email).trim().charAt(0).toUpperCase();

                  return (
                    <li key={user.id} className={own.userRow}>
                      <span className={own.avatar} aria-hidden="true">
                        {initial}
                      </span>
                      <div className={own.userInfo}>
                        <strong>
                          {user.name || user.email}
                          {isMe ? <span className={own.meTag}>você</span> : null}
                        </strong>
                        {user.name ? <span>{user.email}</span> : null}
                        <span className={own.lastSeen}>
                          Último acesso: {formatDate(user.lastSignInAt)}
                        </span>
                      </div>
                      {isMe ? null : (
                        <button
                          type="button"
                          className={`${styles.btn} ${styles.btnSmall} ${own.removeBtn}`}
                          onClick={() => handleDelete(user)}
                        >
                          Remover
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
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

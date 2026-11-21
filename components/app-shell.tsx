"use client";

// Moldura comum das telas internas, no mesmo estilo do AlfredOps:
// menu lateral escuro, item ativo em azul, "Trocar loja" e "Sair" embaixo.

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import styles from "./app-shell.module.css";

type Active = "produtos" | "lojas" | "usuarios";
type Store = { id: string; name: string };

const icons = {
  box: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M21 8 12 3 3 8v8l9 5 9-5V8Z" />
      <path d="m3 8 9 5 9-5M12 13v8" />
    </svg>
  ),
  store: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 10v10h16V10" />
      <path d="M3 4h18l-1.5 6a3 3 0 0 1-5.5.5 3 3 0 0 1-5 0A3 3 0 0 1 4.5 10L3 4Z" />
      <path d="M10 20v-5h4v5" />
    </svg>
  ),
  users: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="9" cy="8" r="3.5" />
      <path d="M2.5 20a6.5 6.5 0 0 1 13 0" />
      <path d="M16 4.5a3.5 3.5 0 0 1 0 7M18.5 14a6.5 6.5 0 0 1 3 6" />
    </svg>
  ),
  swap: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 8h14l-3-3M20 16H6l3 3" />
    </svg>
  ),
  logout: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M14 4h5v16h-5" />
      <path d="M10 8l-4 4 4 4M6 12h10" />
    </svg>
  )
};

export default function AppShell({ active, children }: { active: Active; children: ReactNode }) {
  const router = useRouter();
  const [isAdmin, setIsAdmin] = useState(false);
  const [stores, setStores] = useState<Store[]>([]);
  const [activeId, setActiveId] = useState("");

  useEffect(() => {
    fetch("/api/auth/me", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => setIsAdmin(Boolean(json?.isAdmin)))
      .catch(() => null);

    fetch("/api/stores", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        if (!json) return;
        setStores(json.stores ?? []);
        setActiveId(json.activeId ?? "");
      })
      .catch(() => null);
  }, []);

  async function switchStore(storeId: string) {
    if (!storeId || storeId === activeId) return;
    const res = await fetch("/api/stores/active", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ storeId })
    });
    if (res.ok) window.location.reload();
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => null);
    router.push("/login");
  }

  const activeStore = stores.find((s) => s.id === activeId);

  return (
    <div className={styles.asShell}>
      <aside className={styles.asSidebar}>
        <div className={styles.asBrand}>
          <Image
            src="/Ellos-Escrito-Logo-Preto.png"
            alt="Ellos"
            width={260}
            height={80}
            className={styles.asLogo}
            priority
          />
          <span className={styles.asBrandSub}>Cadastro</span>
        </div>

        <nav className={styles.asNav}>
          <span className={styles.asSection}>Cadastro</span>
          <Link
            href="/admin"
            className={`${styles.asItem} ${active === "produtos" ? styles.asItemActive : ""}`}
          >
            {icons.box}
            Produtos
          </Link>

          {isAdmin ? (
            <>
              <span className={styles.asSection}>Gestão</span>
              <Link
                href="/lojas"
                className={`${styles.asItem} ${active === "lojas" ? styles.asItemActive : ""}`}
              >
                {icons.store}
                Lojas
              </Link>
              <Link
                href="/usuarios"
                className={`${styles.asItem} ${active === "usuarios" ? styles.asItemActive : ""}`}
              >
                {icons.users}
                Usuários
              </Link>
            </>
          ) : null}
        </nav>

        <div className={styles.asBottom}>
          {stores.length > 1 ? (
            <label className={styles.asStoreBtn}>
              {icons.swap}
              <span className={styles.asStoreText}>
                <small>Trocar loja</small>
                <select
                  value={activeId}
                  onChange={(e) => switchStore(e.target.value)}
                  aria-label="Trocar loja"
                >
                  {stores.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </span>
            </label>
          ) : activeStore ? (
            <div className={styles.asStoreBtn}>
              {icons.store}
              <span className={styles.asStoreText}>
                <small>Loja</small>
                <strong>{activeStore.name}</strong>
              </span>
            </div>
          ) : null}

          <button type="button" className={styles.asLogoutBtn} onClick={logout}>
            {icons.logout}
            Sair
          </button>
        </div>

        <p className={styles.asFooter}>© {new Date().getFullYear()} MG</p>
      </aside>

      <div className={styles.asMain}>{children}</div>
    </div>
  );
}

"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import styles from "./login.module.css";

type Mode = "loading" | "login" | "setup";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("loading");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetch("/api/auth/setup", { cache: "no-store" })
      .then((res) => res.json())
      .then((json) => setMode(json.needsSetup ? "setup" : "login"))
      .catch(() => setMode("login"));
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (mode === "setup" && password !== passwordConfirm) {
      setError("As senhas não são iguais.");
      return;
    }

    setIsSubmitting(true);

    try {
      const res = await fetch(mode === "setup" ? "/api/auth/setup" : "/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password })
      });
      const json = await res.json();

      if (!res.ok) {
        setError(json.error || "Não foi possível entrar.");
        return;
      }

      router.push("/admin");
      router.refresh();
    } catch {
      setError("Não foi possível conectar. Tente de novo.");
    } finally {
      setIsSubmitting(false);
    }
  }

  const isSetup = mode === "setup";

  return (
    <main className={styles.page}>
      <form className={styles.card} onSubmit={handleSubmit}>
        <Image
          src="/Ellos-Escrito-Logo-Preto.png"
          alt="Ellos"
          width={260}
          height={80}
          className={styles.logo}
          priority
        />

        {mode === "loading" ? (
          <p className={styles.subtitle}>Carregando…</p>
        ) : (
          <>
            <p className={styles.subtitle}>
              {isSetup
                ? "Bem-vindo! Crie o primeiro acesso ao facilitador de cadastro."
                : "Acesse o facilitador de cadastro de produtos."}
            </p>

            <div className={styles.fields}>
              {isSetup ? (
                <label className={styles.label}>
                  Seu nome
                  <input
                    className={styles.input}
                    placeholder="Ex: Mario"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    autoComplete="name"
                  />
                </label>
              ) : null}

              <label className={styles.label}>
                E-mail
                <input
                  className={styles.input}
                  type="email"
                  placeholder="voce@exemplo.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  required
                />
              </label>

              <label className={styles.label}>
                Senha
                <input
                  className={styles.input}
                  type="password"
                  placeholder={isSetup ? "Pelo menos 8 caracteres" : "Digite sua senha"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete={isSetup ? "new-password" : "current-password"}
                  required
                />
              </label>

              {isSetup ? (
                <label className={styles.label}>
                  Repita a senha
                  <input
                    className={styles.input}
                    type="password"
                    placeholder="Digite a senha de novo"
                    value={passwordConfirm}
                    onChange={(e) => setPasswordConfirm(e.target.value)}
                    autoComplete="new-password"
                    required
                  />
                </label>
              ) : null}
            </div>

            {error && <p className={styles.error}>{error}</p>}

            <button className={styles.button} type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Aguarde…" : isSetup ? "Criar acesso e entrar" : "Entrar"}
            </button>

            {!isSetup ? (
              <p className={styles.helper}>
                Não tem acesso? Peça para alguém da equipe criar um usuário para você.
              </p>
            ) : null}
          </>
        )}

        <p className={styles.footer}>Powered by MG</p>
      </form>
    </main>
  );
}

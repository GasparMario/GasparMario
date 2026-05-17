"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState } from "react";
import styles from "./login.module.css";

export default function LoginPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  function handleLogin(e: React.FormEvent) {
    e.preventDefault();

    if (password === "ellos123") {
      localStorage.setItem("ellos-auth", "true");
      router.push("/admin");
      return;
    }

    setError("Senha inválida.");
  }

  return (
    <main className={styles.page}>
      <form className={styles.card} onSubmit={handleLogin}>
        <Image
          src="/Ellos-Escrito-Logo-Preto.png"
          alt="Ellos"
          width={260}
          height={80}
          className={styles.logo}
        />

        <p className={styles.subtitle}>
          Acesse o facilitador de cadastro de produtos.
        </p>

        <label className={styles.label}>
          Senha de acesso
          <input
            className={styles.input}
            type="password"
            placeholder="Digite a senha"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>

        {error && <p className={styles.error}>{error}</p>}

        <button className={styles.button} type="submit">
          Entrar
        </button>

        <p className={styles.footer}>Powered by AlfredOps</p>
      </form>
    </main>
  );
}
import Link from "next/link";

export default function HomePage() {
  return (
    <main style={{ fontFamily: "sans-serif", maxWidth: 860, margin: "48px auto", lineHeight: 1.5 }}>
      <h1>GasparMario (Next.js)</h1>
      <p>Abra o admin para gerenciar cores e gerar CSV para WooCommerce.</p>
      <Link href="/admin">Ir para /admin</Link>
    </main>
  );
}

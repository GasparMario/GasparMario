import type { Metadata } from "next";
import { Outfit } from "next/font/google";
import "./globals.css";

// Fonte geométrica parecida com a do AlfredOps.
const outfit = Outfit({ subsets: ["latin"], variable: "--font-sans", display: "swap" });

export const metadata: Metadata = {
  title: "Ellos Cadastro",
  description: "Facilitador de Cadastro de Produtos"
};

export default function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR" className={outfit.variable}>
      <body>{children}</body>
    </html>
  );
}
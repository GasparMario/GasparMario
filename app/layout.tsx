import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "GasparMario",
  description: "Fluxo de catálogo com variações para WooCommerce"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}

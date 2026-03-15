import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "dtf-manager",
  description: "Sistema web para gerenciamento de PDFs de estampas DTF"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}

import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Horar.io — Que horas eram?",
  description:
    "Observe uma fotografia e tente descobrir o horário exato em que ela foi tirada.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}

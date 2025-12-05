import type { Metadata } from "next";
import "./globals.css";
import AppLayout from "./(app)/layout";

export const metadata: Metadata = {
  title: "Inventário SPED",
  description: "Sistema de inventário SPED",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body className="antialiased">
        <AppLayout>{children}</AppLayout>
      </body>
    </html>
  );
}


import type { Metadata } from "next";
import { Figtree, DM_Mono } from "next/font/google";
import "@tabler/icons-webfont/dist/tabler-icons.min.css";
import "./globals.css";

const figtree = Figtree({
  weight: ["400", "500", "600", "900"],
  subsets: ["latin"],
  variable: "--font-figtree",
  display: "swap",
});

const dmMono = DM_Mono({
  weight: ["400", "500"],
  subsets: ["latin"],
  variable: "--font-dm-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "SOCLE — Tu sais poser. On s'occupe du reste.",
  description:
    "SOCLE est le compagnon de route de l'artisan qui devient entrepreneur BTP : du dépôt de statut à ton premier chantier rentable. Conçu par un artisan, pour les artisans.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fr" className={`${figtree.variable} ${dmMono.variable}`}>
      <body>{children}</body>
    </html>
  );
}

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
  title: "SOCLE — Le kit de lancement du créateur BTP",
  description:
    "SOCLE — le kit de lancement du créateur BTP : de l'immatriculation à ton premier chantier rentable. Statut, taux horaire, chiffrage, devis, PV de réception. Conçu par un artisan, pour les artisans.",
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

import type { Metadata } from "next";
import { Figtree, DM_Mono } from "next/font/google";
import "@tabler/icons-webfont/dist/tabler-icons.min.css";
import "./globals.css";

const figtree = Figtree({
  weight: ["400", "500", "600"],
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
  title: "SOCLE — Pilotez votre activité BTP",
  description:
    "SOCLE : la boîte à outils des artisans du bâtiment — chiffrage, rentabilité, devis, PV de réception et plus.",
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

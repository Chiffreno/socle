// ============================================================
// SOCLE — Module Devis — Helpers de formatage (fr-FR)
// ============================================================

/** Montant en euros, 2 décimales, séparateurs français. Ex: "1 234,50 €". */
export function formatEuro(n: number): string {
  return (
    (n || 0).toLocaleString("fr-FR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }) + " €"
  );
}

/** Date ISO (YYYY-MM-DD) → "JJ/MM/AAAA". Renvoie "—" si vide/invalide. */
export function formatDateFR(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("fr-FR");
}

/** Pourcentage formaté. Ex: "30 %" / "51,25 %". */
export function formatPct(n: number): string {
  return (
    (n || 0).toLocaleString("fr-FR", { maximumFractionDigits: 2 }) + " %"
  );
}

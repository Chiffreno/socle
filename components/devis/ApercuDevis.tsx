"use client";

// ============================================================
// SOCLE — Page PLEIN ÉCRAN du document client : DEVIS (/apercu)
//
// Enveloppe de présentation : charge le devis depuis le repository, ajoute la
// barre d'outils (retour éditeur + impression) et rend le document via
// <ApercuDocument> — le MÊME corps A4 que celui intégré dans la finalisation
// (source de rendu unique, aucune duplication). Impression : window.print().
// ============================================================

import { useEffect, useState } from "react";
import Link from "next/link";
import { repository } from "@/lib/devis/repository";
import ApercuDocument from "./ApercuDocument";
import type { Chantier, Devis, Entreprise } from "@/lib/devis/types";
import "./apercu.css";

interface Props {
  devisId: string;
}

export default function ApercuDevis({ devisId }: Props) {
  const [devis, setDevis] = useState<Devis | null>(null);
  const [entreprise, setEntreprise] = useState<Entreprise | null>(null);
  const [chantier, setChantier] = useState<Chantier | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      const [d, ent, ch] = await Promise.all([
        repository.devis.get(devisId),
        repository.entreprise.get(),
        repository.chantiers.ofDevis(devisId),
      ]);
      if (!alive) return;
      setDevis(d);
      setEntreprise(ent);
      setChantier(ch);
      setLoaded(true);
    })();
    return () => {
      alive = false;
    };
  }, [devisId]);

  if (!loaded) return <div className="ap-page">Chargement…</div>;
  if (!devis) {
    return (
      <div className="ap-page">
        <p>Devis introuvable.</p>
        <Link href="/chantiers">← Retour aux chantiers</Link>
      </div>
    );
  }

  return (
    <div className="ap-page">
      <div className="ap-toolbar">
        <Link href={`/chantier/devis/${devisId}/editer`} className="ap-btn">
          ← Retour à l&apos;éditeur
        </Link>
        <button
          type="button"
          className="ap-btn ap-btn-print"
          onClick={() => window.print()}
        >
          Imprimer / Enregistrer en PDF
        </button>
        <span className="ap-toolbar-note">
          Document client — prix de vente uniquement
        </span>
      </div>

      <ApercuDocument
        devis={devis}
        entreprise={entreprise}
        chantier={chantier}
      />
    </div>
  );
}

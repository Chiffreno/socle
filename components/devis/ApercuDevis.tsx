"use client";

// ============================================================
// SOCLE — Aperçu client minimal P3
//
// Réécriture P3 pour rester branchée sur le moteur (calcEngineTotaux +
// calcItems). Volontairement BRUT : ce n'est PAS le document client
// final stylé (réécrit en P5, cf. memory devis-p5-apercu-spec.md). Le
// but est uniquement de permettre la vérification visuelle pendant P3
// et P4 — chiffres lisibles, structure claire, aucune mise en forme PDF.
//
// RÈGLES CLIENT NON NÉGOCIABLES :
//   - AUCUN coût interne / MO / marge / récap artisan : prix de vente
//     UNIQUEMENT.
//   - Vert INTERDIT (le vert reste réservé à l'interface artisan dans
//     l'éditeur). Noir, gris uniquement.
//
// Prix de vente affiché par ligne :
//   - prixEstFinal=true (points)   → item.p (prix catalogue brut)
//   - prixEstFinal=false (déboursé) → item.p × coefDeboursé, où
//                                      coefDeboursé = caDeboursé / deboursé
//     (distribue matériaux + MO + marge proportionnellement aux lignes).
//   La remise globale n'est PAS distribuée par ligne (apparaît en bas
//   du document comme un poste séparé, comme sur un devis classique).
// ============================================================

import { Fragment, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { repository } from "@/lib/devis/repository";
import { calcEngineTotaux, type LotTotaux } from "@/lib/devis/engine/totals";
import { calcItems } from "@/lib/devis/engine/calc-items";
import {
  agregerLignesClient,
  type LigneClient,
} from "@/lib/devis/engine/agregation";
import { LM } from "@/lib/devis/engine/lots";
import type { LotId, EngineLigne } from "@/lib/devis/engine/types";
import { formatEuro, formatDateFR } from "@/lib/devis/format";
import { STATUT_LABEL } from "@/lib/devis/devis-status";
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
      // L'adresse de chantier provient du Chantier parent (via chantierId),
      // plus des champs du devis : on résout via la jointure inverse.
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

  // Totaux (entreprise.tauxHoraire utilisé pour la formule marge — il
  // alimente les totaux client via caDeboursé, mais aucun champ interne
  // n'est exposé sur le document ci-dessous).
  const totaux = useMemo(() => {
    if (!devis?.engine) return null;
    return calcEngineTotaux(devis.engine, entreprise?.tauxHoraire ?? 0);
  }, [devis, entreprise]);

  if (!loaded) return <div className="ap-page">Chargement…</div>;
  if (!devis) {
    return (
      <div className="ap-page">
        <p>Devis introuvable.</p>
        <Link href="/chantiers">← Retour aux chantiers</Link>
      </div>
    );
  }

  const lotsActifs = LM.filter((m) => devis.engine.lots[m.id]?.on);

  const acompteTTC = totaux
    ? Math.round(totaux.totalTTC * (devis.acomptePct / 100) * 100) / 100
    : 0;
  const soldeTTC = totaux ? totaux.totalTTC - acompteTTC : 0;

  return (
    <div className="ap-page">
      <div className="ap-toolbar">
        <Link href={`/chantier/devis/${devisId}/editer`} className="ap-btn">
          ← Retour à l&apos;éditeur
        </Link>
        <span className="ap-toolbar-note">
          Aperçu minimal P3 — document client stylé en P5
        </span>
      </div>

      <article className="ap-doc">
        {/* ── EN-TÊTE ENTREPRISE + MÉTA DOCUMENT ─────────────────── */}
        <header className="ap-doc-head">
          <div className="ap-ent">
            <h1 className="ap-ent-name">
              {entreprise?.raisonSociale || "(Entreprise non configurée)"}
            </h1>
            {(entreprise?.formeJuridique || entreprise?.capital != null) && (
              <p className="ap-ent-line">
                {entreprise.formeJuridique}
                {entreprise.capital != null
                  ? ` — Capital ${formatEuro(entreprise.capital)}`
                  : ""}
              </p>
            )}
            <p className="ap-ent-line">
              {entreprise?.adresse}
              {entreprise?.codePostal && entreprise?.ville
                ? `, ${entreprise.codePostal} ${entreprise.ville}`
                : ""}
            </p>
            <p className="ap-ent-line">
              {entreprise?.siret ? `SIRET ${entreprise.siret}` : ""}
              {entreprise?.tvaIntracom
                ? ` · TVA ${entreprise.tvaIntracom}`
                : ""}
            </p>
            {(entreprise?.email || entreprise?.telephone) && (
              <p className="ap-ent-line">
                {entreprise.email}
                {entreprise.email && entreprise.telephone ? " · " : ""}
                {entreprise.telephone}
              </p>
            )}
            {entreprise?.assuranceCompagnie && (
              <p className="ap-ent-line ap-ent-assurance">
                Assurance décennale : {entreprise.assuranceCompagnie}
                {entreprise.assurancePolice
                  ? ` — police ${entreprise.assurancePolice}`
                  : ""}
              </p>
            )}
          </div>
          <div className="ap-meta">
            <p className="ap-meta-titre">DEVIS</p>
            <p className="ap-meta-num">N° {devis.numero || "—"}</p>
            <p className="ap-meta-line">
              Édité le {formatDateFR(devis.dateCreation)}
            </p>
            {devis.dateValidite && (
              <p className="ap-meta-line">
                Valide jusqu&apos;au {formatDateFR(devis.dateValidite)}
              </p>
            )}
            <p className="ap-meta-statut">
              {STATUT_LABEL[devis.statut] || devis.statut}
            </p>
          </div>
        </header>

        {/* ── PARTIES : Client + Chantier ─────────────────────────── */}
        <section className="ap-parties">
          <div>
            <h3 className="ap-h3">Client</h3>
            {devis.clientSnapshot ? (
              <>
                <p className="ap-strong">
                  {[devis.clientSnapshot.prenom, devis.clientSnapshot.nom]
                    .filter(Boolean)
                    .join(" ") || "—"}
                </p>
                {devis.clientSnapshot.adresse && (
                  <p>{devis.clientSnapshot.adresse}</p>
                )}
                {(devis.clientSnapshot.codePostal ||
                  devis.clientSnapshot.ville) && (
                  <p>
                    {devis.clientSnapshot.codePostal}{" "}
                    {devis.clientSnapshot.ville}
                  </p>
                )}
                {devis.clientSnapshot.email && (
                  <p>{devis.clientSnapshot.email}</p>
                )}
                {devis.clientSnapshot.telephone && (
                  <p>{devis.clientSnapshot.telephone}</p>
                )}
              </>
            ) : (
              <p className="ap-muted">(Client non renseigné)</p>
            )}
          </div>
          <div>
            <h3 className="ap-h3">Chantier</h3>
            {chantier &&
            (chantier.adresse || chantier.codePostal || chantier.ville) ? (
              <>
                {chantier.adresse && <p>{chantier.adresse}</p>}
                {(chantier.codePostal || chantier.ville) && (
                  <p>
                    {chantier.codePostal} {chantier.ville}
                  </p>
                )}
              </>
            ) : (
              <p className="ap-muted">(Adresse non renseignée)</p>
            )}
          </div>
        </section>

        {devis.titre && (
          <section className="ap-objet">
            <h2 className="ap-h2">{devis.titre}</h2>
          </section>
        )}
        {devis.lettreIntro && (
          <section className="ap-intro">
            {devis.lettreIntro.split("\n").map((line, i) => (
              <p key={i}>{line}</p>
            ))}
          </section>
        )}

        {/* ── DÉTAIL PAR LOT ──────────────────────────────────────── */}
        {lotsActifs.length === 0 ? (
          <p className="ap-muted">Aucun lot actif sur ce devis.</p>
        ) : (
          <section className="ap-lots">
            {lotsActifs.map((meta) => {
              const lotTotaux = totaux?.parLot.find(
                (l) => l.lotId === meta.id
              );
              const items = calcItems(devis.engine, meta.id);
              // Brique 1 : lignes client agrégées si le lot a une stratégie
              // (cloisons). Sinon null → rendu legacy ligne-à-ligne.
              const lignesClient = lotTotaux
                ? agregerLignesClient(devis.engine, lotTotaux)
                : null;
              return (
                <LotTable
                  key={meta.id}
                  label={meta.label}
                  items={items}
                  lignesClient={lignesClient}
                  lotTotaux={lotTotaux}
                />
              );
            })}
          </section>
        )}

        {/* ── TOTAUX ──────────────────────────────────────────────── */}
        {totaux && (
          <section className="ap-totaux">
            <dl>
              <dt>Sous-total HT</dt>
              <dd>{formatEuro(totaux.subTotalHT)}</dd>
              {totaux.remiseHT > 0 && (
                <Fragment>
                  <dt>
                    Remise
                    {devis.remiseMode === "pourcent"
                      ? ` (${devis.remiseValeur} %)`
                      : ""}
                  </dt>
                  <dd>−{formatEuro(totaux.remiseHT)}</dd>
                </Fragment>
              )}
              <dt className="ap-strong">Total HT</dt>
              <dd className="ap-strong">{formatEuro(totaux.totalHT)}</dd>
              {Object.entries(totaux.ventilationTVA)
                .sort(([a], [b]) => Number(a) - Number(b))
                .map(([taux, m]) => (
                  <Fragment key={taux}>
                    <dt>TVA {taux} %</dt>
                    <dd>{formatEuro(m)}</dd>
                  </Fragment>
                ))}
              <dt className="ap-ttc">Total TTC</dt>
              <dd className="ap-ttc">{formatEuro(totaux.totalTTC)}</dd>
            </dl>
          </section>
        )}

        {totaux && totaux.totalTTC > 0 && (
          <section className="ap-acompte">
            <h3 className="ap-h3">Modalités de règlement</h3>
            <p>
              Acompte de {devis.acomptePct} % à la commande :{" "}
              <strong>{formatEuro(acompteTTC)}</strong> TTC.
            </p>
            <p>
              Solde à la fin des travaux :{" "}
              <strong>{formatEuro(soldeTTC)}</strong> TTC.
            </p>
          </section>
        )}

        {/* Mentions légales BTP : réintégrées sur le document final en
            P5 (cf. devis-p5-apercu-spec.md). En P3 on n'affiche qu'un
            rappel pour ne pas brouiller la vérification visuelle. */}
        <section className="ap-mentions">
          <p className="ap-muted ap-mentions-note">
            (Les mentions légales BTP, conditions générales et bloc
            signatures seront réintégrés sur le document final en P5.)
          </p>
        </section>
      </article>
    </div>
  );
}

// ─── LotTable ────────────────────────────────────────────────────────
// Affiche les lignes d'un lot avec leur prix de vente unitaire et total
// LIGNE PAR LIGNE (= caDeboursé distribué × coefDeboursé pour les
// déboursé, prix catalogue tel quel pour les points prix ferme).
function LotTable({
  label,
  items,
  lignesClient,
  lotTotaux,
}: {
  label: string;
  items: EngineLigne[];
  /** Brique 1 : lignes client agrégées (cloisons). null → rendu legacy. */
  lignesClient: LigneClient[] | null;
  lotTotaux: LotTotaux | undefined;
}) {
  const coefDeboursé =
    lotTotaux && lotTotaux.deboursé > 0
      ? lotTotaux.caDeboursé / lotTotaux.deboursé
      : 0;

  // Rendu AGRÉGÉ (lignes client synthétiques) si une stratégie existe pour
  // le lot. Le détail interne (consommables) n'est jamais montré au client.
  const useAggrege = lignesClient !== null;
  const isEmpty = useAggrege
    ? lignesClient!.length === 0
    : items.length === 0;

  return (
    <div className="ap-lot">
      <div className="ap-lot-head">
        <h3 className="ap-lot-title">{label}</h3>
        <span className="ap-lot-sub">
          {lotTotaux ? formatEuro(lotTotaux.caLot) + " HT" : ""}
        </span>
      </div>
      {isEmpty ? null : (
        <table className="ap-lot-items">
          <thead>
            <tr>
              <th className="lbl">Désignation</th>
              <th className="qty">Qté</th>
              <th className="qty">U.</th>
              <th className="pu">P.U. HT</th>
              <th className="tva">TVA</th>
              <th className="total">Total HT</th>
            </tr>
          </thead>
          <tbody>
            {useAggrege
              ? lignesClient!.map((lc, i) => (
                  <tr key={i}>
                    <td className="lbl">
                      {lc.libelleCommercial}
                      {lc.afficheFourniture &&
                        lc.dontFourniture !== undefined && (
                          <small>
                            dont fourniture : {formatEuro(lc.dontFourniture)}
                          </small>
                        )}
                    </td>
                    <td className="qty">{lc.qty}</td>
                    <td className="qty">{lc.unit}</td>
                    <td className="pu">{formatEuro(lc.prixUnitaireClient)}</td>
                    <td className="tva">{lc.tva} %</td>
                    <td className="total">{formatEuro(lc.prixClient)}</td>
                  </tr>
                ))
              : items.map((it, i) => {
                  const lineCA = it.prixEstFinal
                    ? it.total
                    : it.total * coefDeboursé;
                  const lineP = it.qty > 0 ? lineCA / it.qty : 0;
                  return (
                    <tr key={i}>
                      <td className="lbl">
                        {it.lbl}
                        {it.note && <small>{it.note}</small>}
                      </td>
                      <td className="qty">{it.qty}</td>
                      <td className="qty">{it.unit}</td>
                      <td className="pu">{formatEuro(lineP)}</td>
                      <td className="tva">{it.tva ?? "—"} %</td>
                      <td className="total">{formatEuro(lineCA)}</td>
                    </tr>
                  );
                })}
          </tbody>
        </table>
      )}
    </div>
  );
}

// Used only by Lot label resolution if needed in the future.
export type _UnusedLotId = LotId;

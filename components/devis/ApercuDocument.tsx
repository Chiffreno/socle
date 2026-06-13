"use client";

// ============================================================
// SOCLE — Corps du document client : DEVIS (feuille A4)
//
// SOURCE UNIQUE de rendu du document. Utilisé tel quel par :
//   · ApercuDevis  → page plein écran /apercu (toolbar + impression),
//   · DevisFinalisation → aperçu intégré live à côté des réglages.
//
// Purement présentationnel : reçoit `devis` / `entreprise` / `chantier` déjà
// résolus (aucun chargement ici) et dérive totaux + lignes client. Charte DOC
// CLIENT (noir/gris + accent paramétrable). AUCUNE donnée interne (marge, MO,
// déboursé, détail matière, notes internes) — uniquement les champs client.
// ============================================================

import { Fragment, useMemo, type CSSProperties, type ReactNode } from "react";
import { calcEngineTotaux } from "@/lib/devis/engine/totals";
import {
  agregerLignesClient,
  calcClientTotaux,
  lignesLibresClient,
  lignesLotLibre,
  type LigneClient,
} from "@/lib/devis/engine/agregation";
import { LM } from "@/lib/devis/engine/lots";
import { formatEuro, formatDateFR } from "@/lib/devis/format";
import { STATUT_LABEL } from "@/lib/devis/devis-status";
import { resoudreEcheancier } from "@/lib/devis/echeancier";
import type {
  Chantier,
  Devis,
  EcheanceMoment,
  Entreprise,
} from "@/lib/devis/types";
import "./apercu.css";

interface Props {
  devis: Devis;
  entreprise: Entreprise | null;
  chantier: Chantier | null;
}

// Moment en toutes lettres pour le document client. Dupliqué ici à dessein :
// le document ne dépend PAS d'un composant d'UI (la finalisation a sa propre
// copie). 3 entrées, même libellé.
const MOMENT_LABEL: Record<EcheanceMoment, string> = {
  commande: "à la commande",
  encours: "en cours de chantier",
  reception: "à la réception",
};

/** % effectif d'une échéance, format FR sobre (entier, ou 1 décimale). */
function formatPct(p: number): string {
  const r = Math.round(p * 10) / 10;
  const s = Number.isInteger(r) ? String(r) : r.toFixed(1).replace(".", ",");
  return `${s} %`;
}

interface DocLine {
  num: string;
  libelle: string;
  description: string;
  qty: number;
  unit: string;
  puHT: number;
  tva: number;
  totalHT: number;
  /** Sous-titre de catégorie (élec) — eyebrow de groupe. */
  categorie?: string;
  /** C-split (élec) : décomposition client fourniture / pose. */
  fourniture?: number;
  pose?: number;
}
interface DocLot {
  num: string;
  titre: string;
  htLot: number;
  lines: DocLine[];
}

const ACCENT_DEFAULT = "#1a7a3c";

// ─── Garde-fou contraste : assombrit l'accent s'il est trop clair pour servir
//     de texte/filet sur fond blanc (sans bloquer le choix de l'artisan). ─────
function hexToRgb(hex: string): [number, number, number] | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function relLum([r, g, b]: [number, number, number]): number {
  const a = [r, g, b].map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * a[0] + 0.7152 * a[1] + 0.0722 * a[2];
}
function toHex([r, g, b]: [number, number, number]): string {
  const h = (v: number) =>
    Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0");
  return `#${h(r)}${h(g)}${h(b)}`;
}
/** Couleur d'« encre » accent : assombrie tant que sa luminance dépasse ~0,4. */
function accentInk(hex: string): string {
  let rgb = hexToRgb(hex);
  if (!rgb) return ACCENT_DEFAULT;
  let guard = 0;
  while (relLum(rgb) > 0.4 && guard < 14) {
    rgb = [rgb[0] * 0.85, rgb[1] * 0.85, rgb[2] * 0.85];
    guard++;
  }
  return toHex(rgb);
}

function ph(value: string | undefined | null, label: string) {
  return value && value.trim() ? value.trim() : <span className="ap-ph">[{label}]</span>;
}

export default function ApercuDocument({ devis, entreprise, chantier }: Props) {
  const clientTotaux = useMemo(() => {
    if (!devis?.engine) return null;
    const t = calcEngineTotaux(
      devis.engine,
      entreprise?.tauxHoraire ?? 0,
      devis.regimeTVA
    );
    return { client: calcClientTotaux(devis.engine, t), engine: t };
  }, [devis, entreprise]);

  const docLots = useMemo<DocLot[]>(() => {
    if (!devis?.engine || !clientTotaux) return [];
    const { engine } = devis;
    const tva0 = engine.tvaParDefaut;
    const out: DocLot[] = [];
    let n = 0;
    const toLine = (lc: LigneClient, num: string): DocLine => ({
      num,
      libelle: lc.libelleCommercial,
      description: lc.description,
      qty: lc.qty,
      unit: lc.unit,
      puHT: lc.prixUnitaireClient,
      tva: lc.tva,
      totalHT: lc.prixClient,
      categorie: lc.categorie,
      fourniture: lc.fournitureClient,
      pose: lc.poseClient,
    });
    for (const meta of LM.filter((m) => engine.lots[m.id]?.on)) {
      const lt = clientTotaux.engine.parLot.find((l) => l.lotId === meta.id)!;
      const lotState = engine.lots[meta.id];
      const htLot = clientTotaux.client.parLotClientHT[meta.id] ?? lt.caLot ?? 0;
      let lignes: LigneClient[] = agregerLignesClient(engine, lt) ?? [];
      lignes = [...lignes, ...lignesLibresClient(lotState, tva0)];
      if (lignes.length === 0) {
        if (htLot <= 0) continue;
        n += 1;
        out.push({
          num: `${n}.0`,
          titre: meta.label,
          htLot,
          lines: [
            {
              num: `${n}.1`,
              libelle: meta.label,
              description: "",
              qty: 1,
              unit: "forfait",
              puHT: htLot,
              tva: lotState.tva ?? tva0,
              totalHT: htLot,
            },
          ],
        });
        continue;
      }
      n += 1;
      out.push({
        num: `${n}.0`,
        titre: meta.label,
        htLot,
        lines: lignes.map((lc, i) => toLine(lc, `${n}.${i + 1}`)),
      });
    }
    for (const lot of engine.lotsLibres ?? []) {
      const lignes = lignesLotLibre(lot, tva0);
      if (lignes.length === 0) continue;
      n += 1;
      const htLot = clientTotaux.client.parLotClientHT[lot.id] ?? 0;
      out.push({
        num: `${n}.0`,
        titre: lot.titre || "Lot libre",
        htLot,
        lines: lignes.map((lc, i) => toLine(lc, `${n}.${i + 1}`)),
      });
    }
    return out;
  }, [devis, clientTotaux]);

  const ct = clientTotaux?.client ?? null;
  const accent = entreprise?.couleurAccent || ACCENT_DEFAULT;
  const docStyle = {
    "--ap-accent": accent,
    "--ap-accent-ink": accentInk(accent),
  } as CSSProperties;

  // Échéancier résolu — resoudreEcheancier est la SEULE source des montants.
  // Total passé = EXACTEMENT le total TTC affiché dans le récap du document
  // (ct.totalTTC, après remise) → la somme des échéances retombe au centime.
  const echeances = ct ? resoudreEcheancier(devis.echeancier ?? [], ct.totalTTC) : [];
  const cs = devis.clientSnapshot;
  const clientNom = cs
    ? [cs.prenom, cs.nom].filter(Boolean).join(" ").trim() || cs.nom
    : "";

  // Délai prévisionnel.
  const dDebut = devis.dateDebutPrevue;
  const dFin = devis.dateFinPrevue;
  let delaiTxt: ReactNode;
  if (dDebut && dFin) {
    const jours = Math.max(
      0,
      Math.round(
        (new Date(dFin).getTime() - new Date(dDebut).getTime()) / 86_400_000
      )
    );
    delaiTxt = (
      <>
        Travaux prévus du <strong>{formatDateFR(dDebut)}</strong> au{" "}
        <strong>{formatDateFR(dFin)}</strong>
        {jours > 0 ? ` — durée estimée ${jours} jours.` : "."}
      </>
    );
  } else if (dDebut) {
    delaiTxt = (
      <>
        Travaux prévus à partir du <strong>{formatDateFR(dDebut)}</strong>.
      </>
    );
  } else if (dFin) {
    delaiTxt = (
      <>
        Achèvement prévu au <strong>{formatDateFR(dFin)}</strong>.
      </>
    );
  } else {
    delaiTxt = <span className="ap-ph">[délai à préciser]</span>;
  }

  const validiteTxt = devis.dateValidite
    ? `jusqu'au ${formatDateFR(devis.dateValidite)}`
    : entreprise?.validiteJours
      ? `${entreprise.validiteJours} jours à compter de l'émission`
      : "à préciser";

  return (
    <article className="ap-doc" style={docStyle}>
      {/* ── EN-TÊTE : émetteur (logo / coordonnées) + bandeau document ── */}
      <header className="ap-head">
        <div className="ap-emetteur">
          {entreprise?.logo ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img className="ap-logo" src={entreprise.logo} alt="Logo" />
              <p className="ap-emetteur-nom-sub">{entreprise.raisonSociale}</p>
            </>
          ) : (
            <h1 className="ap-emetteur-nom">
              {entreprise?.raisonSociale
                ? entreprise.raisonSociale
                : ph(null, "Raison sociale à renseigner")}
            </h1>
          )}
          <div className="ap-emetteur-meta">
            {(entreprise?.formeJuridique || entreprise?.capital != null) && (
              <p>
                {entreprise?.formeJuridique}
                {entreprise?.capital != null
                  ? ` au capital de ${formatEuro(entreprise.capital)}`
                  : ""}
              </p>
            )}
            <p>
              {ph(entreprise?.adresse, "Adresse à renseigner")}
              {entreprise?.codePostal || entreprise?.ville
                ? `, ${entreprise?.codePostal ?? ""} ${entreprise?.ville ?? ""}`
                : ""}
            </p>
            <p>
              <span className="num">
                SIRET {ph(entreprise?.siret, "SIRET à renseigner")}
              </span>
              {entreprise?.tvaIntracom ? (
                <span className="num"> · TVA {entreprise.tvaIntracom}</span>
              ) : (
                " · TVA intracommunautaire à renseigner"
              )}
            </p>
            {(entreprise?.telephone ||
              entreprise?.email ||
              entreprise?.siteWeb) && (
              <p>
                {[entreprise?.telephone, entreprise?.email, entreprise?.siteWeb]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            )}
          </div>
        </div>
        <div className="ap-docmeta">
          <p className="ap-docmeta-titre">Devis</p>
          <table className="ap-docmeta-t">
            <tbody>
              <tr>
                <td>N°</td>
                <td className="num">{devis.numero || "—"}</td>
              </tr>
              <tr>
                <td>Date</td>
                <td className="num">{formatDateFR(devis.dateCreation)}</td>
              </tr>
              <tr>
                <td>Validité</td>
                <td className="num">
                  {devis.dateValidite
                    ? formatDateFR(devis.dateValidite)
                    : entreprise?.validiteJours
                      ? `${entreprise.validiteJours} j`
                      : "—"}
                </td>
              </tr>
              <tr>
                <td>Statut</td>
                <td>{STATUT_LABEL[devis.statut] || devis.statut}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </header>

      {/* ── PARTIES ───────────────────────────────────────────────── */}
      <section className="ap-parties">
        <div className="ap-partie">
          <h2 className="ap-partie-t">Client</h2>
          {cs ? (
            <>
              <p className="ap-strong">{clientNom || "—"}</p>
              {cs.adresse && <p>{cs.adresse}</p>}
              {(cs.codePostal || cs.ville) && (
                <p>
                  {cs.codePostal} {cs.ville}
                </p>
              )}
              {cs.email && <p>{cs.email}</p>}
              {cs.telephone && <p className="num">{cs.telephone}</p>}
            </>
          ) : (
            <p className="ap-muted">Client non renseigné</p>
          )}
        </div>
        <div className="ap-partie">
          <h2 className="ap-partie-t">Lieu des travaux</h2>
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
            <p className="ap-muted">Adresse non renseignée</p>
          )}
        </div>
      </section>

      {/* ── SYNTHÈSE PAR LOT (vue d'ensemble en tête) ─────────────── */}
      {docLots.length > 0 && ct && (
        <section className="ap-synth">
          <h2 className="ap-bloc-t">Récapitulatif des prestations</h2>
          <table className="ap-synth-t">
            <tbody>
              {docLots.map((lot) => (
                <tr key={lot.num}>
                  <td className="s-num num">{lot.num}</td>
                  <td className="s-lib">{lot.titre}</td>
                  <td className="s-ht num">{formatEuro(lot.htLot)} HT</td>
                </tr>
              ))}
              <tr className="ap-synth-total">
                <td />
                <td className="s-lib">Total HT</td>
                <td className="s-ht num">{formatEuro(ct.totalHT)} HT</td>
              </tr>
            </tbody>
          </table>
        </section>
      )}

      {devis.titre && <h2 className="ap-objet">{devis.titre}</h2>}
      {devis.lettreIntro && (
        <section className="ap-intro">
          {devis.lettreIntro.split("\n").map((line, i) => (
            <p key={i}>{line}</p>
          ))}
        </section>
      )}

      {/* ── DÉLAI PRÉVISIONNEL ────────────────────────────────────── */}
      <section className="ap-delai">
        <h2 className="ap-bloc-t">Délai d&apos;exécution prévisionnel</h2>
        <p>{delaiTxt}</p>
      </section>

      {/* ── DÉTAIL PAR LOT ────────────────────────────────────────── */}
      {docLots.length === 0 ? (
        <p className="ap-muted ap-empty">Aucune prestation sur ce devis.</p>
      ) : (
        docLots.map((lot) => {
          // Sous-titres de catégorie + décompo Fourniture/Pose : uniquement pour
          // les lots qui les portent (élec) — les autres lots inchangés.
          const lotHasFP = lot.lines.some((l) => l.fourniture !== undefined);
          return (
            <section className="ap-lot" key={lot.num}>
              <div className="ap-lot-head">
                <span className="ap-lot-num num">{lot.num}</span>
                <span className="ap-lot-titre">{lot.titre}</span>
                <span className="ap-lot-ht num">
                  {formatEuro(lot.htLot)} HT
                </span>
              </div>
              <table className="ap-lignes">
                <thead>
                  <tr>
                    <th className="c-num">N°</th>
                    <th className="c-des">Désignation</th>
                    <th className="c-qte">Qté</th>
                    <th className="c-u">U.</th>
                    <th className="c-pu">P.U. HT</th>
                    <th className="c-tva">TVA</th>
                    <th className="c-tot">Total HT</th>
                  </tr>
                </thead>
                <tbody>
                  {lot.lines.map((l, i) => {
                    const showCat =
                      lotHasFP &&
                      !!l.categorie &&
                      l.categorie !== lot.lines[i - 1]?.categorie;
                    const hasFP =
                      l.fourniture !== undefined && l.pose !== undefined;
                    return (
                      <Fragment key={l.num}>
                        {showCat && (
                          <tr className="ap-l-cat">
                            <td />
                            <td colSpan={6}>{l.categorie}</td>
                          </tr>
                        )}
                        <tr>
                          <td className="c-num num">{l.num}</td>
                          <td className="c-des">
                            <span className="ap-l-titre">{l.libelle}</span>
                            {l.description && (
                              <span className="ap-l-desc">{l.description}</span>
                            )}
                            {hasFP && (
                              <span className="ap-l-fp">
                                Fourniture&nbsp;: {formatEuro(l.fourniture!)} ·
                                Pose&nbsp;: {formatEuro(l.pose!)}
                              </span>
                            )}
                          </td>
                          <td className="c-qte num">{l.qty}</td>
                          <td className="c-u">{l.unit}</td>
                          <td className="c-pu num">{formatEuro(l.puHT)}</td>
                          <td className="c-tva num">{l.tva} %</td>
                          <td className="c-tot num">{formatEuro(l.totalHT)}</td>
                        </tr>
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </section>
          );
        })
      )}

      {/* ── RÉCAPITULATIF TOTAUX ──────────────────────────────────── */}
      {ct && (
        <section className="ap-totaux">
          <table className="ap-totaux-t">
            <tbody>
              <tr>
                <td>Sous-total HT</td>
                <td className="num">{formatEuro(ct.subTotalHT)}</td>
              </tr>
              {ct.remiseHT > 0 && (
                <tr>
                  <td>
                    Remise
                    {devis.remiseMode === "pourcent"
                      ? ` (${devis.remiseValeur} %)`
                      : ""}
                  </td>
                  <td className="num">−{formatEuro(ct.remiseHT)}</td>
                </tr>
              )}
              <tr className="ap-totaux-ht">
                <td>Total HT</td>
                <td className="num">{formatEuro(ct.totalHT)}</td>
              </tr>
              {Object.entries(ct.ventilationTVA)
                .sort(([a], [b]) => Number(a) - Number(b))
                .map(([taux, m]) => (
                  <tr key={taux}>
                    <td>TVA {taux} %</td>
                    <td className="num">{formatEuro(m)}</td>
                  </tr>
                ))}
              <tr className="ap-totaux-ttc">
                <td>Total TTC</td>
                <td className="num">{formatEuro(ct.totalTTC)}</td>
              </tr>
            </tbody>
          </table>
        </section>
      )}

      {/* ── CONDITIONS (règlement, validité, pénalités) ───────────── */}
      {ct && ct.totalTTC > 0 && (
        <section className="ap-reglement">
          <h2 className="ap-bloc-t">Modalités de règlement</h2>
          {echeances.length === 0 && (
            <p>Paiement intégral à la réception des travaux.</p>
          )}
          {echeances.length > 0 && (
            <table className="ap-ech-t">
              <tbody>
                {echeances.map((e) => {
                  const showPct =
                    e.mode === "pourcent" || e.mode === "solde";
                  return (
                    <tr key={e.id}>
                      <td className="ap-ech-lib">
                        {e.libelle}
                        <span className="ap-ech-moment">
                          {" "}
                          — {MOMENT_LABEL[e.moment]}
                        </span>
                      </td>
                      <td className="ap-ech-pct num">
                        {showPct ? formatPct(e.pourcentEffectif) : ""}
                      </td>
                      <td className="ap-ech-mt num">
                        {formatEuro(e.montantTTC)} TTC
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
          {entreprise?.iban && (
            <p className="ap-muted">
              Règlement par virement — IBAN {entreprise.iban}.
            </p>
          )}
        </section>
      )}

      <section className="ap-mentions">
        <h2 className="ap-bloc-t">Conditions et mentions légales</h2>
        <ul className="ap-mentions-l">
          <li>Devis gratuit, établi avant exécution des travaux.</li>
          <li>Validité de l&apos;offre : {validiteTxt}.</li>
          <li>
            Conditions de paiement : selon l&apos;échéancier indiqué dans les
            modalités de règlement ci-dessus.
          </li>
          <li>
            Pénalités de retard :{" "}
            {typeof entreprise?.penalitesRetardTaux === "number" ? (
              <span className="num">
                {entreprise.penalitesRetardTaux} % par mois de retard
              </span>
            ) : (
              <span className="ap-ph">[taux à préciser]</span>
            )}
            .
          </li>
          <li>
            Assurance responsabilité décennale :{" "}
            {entreprise?.assuranceCompagnie
              ? entreprise.assuranceCompagnie
              : ph(null, "Compagnie d'assurance à renseigner")}
            {entreprise?.assurancePolice
              ? ` — police n° ${entreprise.assurancePolice}`
              : ""}
            {entreprise?.assuranceZone
              ? ` — couverture : ${entreprise.assuranceZone}`
              : ""}
            .
          </li>
          <li>
            Médiateur de la consommation :{" "}
            {ph(null, "à renseigner — obligatoire pour les particuliers")}.
          </li>
          <li className="ap-mentions-flag">
            Si le devis est signé hors de l&apos;établissement (à votre
            domicile), vous bénéficiez d&apos;un droit de rétractation de 14
            jours.{" "}
            <em>
              (Clause générique — à confirmer selon le contexte de signature.)
            </em>
          </li>
          {entreprise?.cgv && <li>{entreprise.cgv}</li>}
        </ul>

        <div className="ap-signature">
          <div className="ap-signature-box">
            <p className="ap-signature-l">
              Mention manuscrite « Devis reçu avant exécution des travaux — Bon
              pour accord », date et signature :
            </p>
            <div className="ap-signature-zone" />
          </div>
        </div>
      </section>
    </article>
  );
}

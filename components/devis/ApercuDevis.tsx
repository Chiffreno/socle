"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { repository } from "@/lib/devis/repository";
import {
  calcDevisTotaux,
  ligneBrutHT,
  montantAcompte,
  round2,
  ventilationTVA,
} from "@/lib/devis/calc";
import { formatDateFR, formatEuro } from "@/lib/devis/format";
import type { Devis, Entreprise } from "@/lib/devis/types";
import "./apercu.css";

const SEUIL_GRATUIT_TTC = 1500;

export default function ApercuDevis({ devisId }: { devisId: string }) {
  const [devis, setDevis] = useState<Devis | null>(null);
  const [entreprise, setEntreprise] = useState<Entreprise | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      const [d, e] = await Promise.all([
        repository.devis.get(devisId),
        repository.entreprise.get(),
      ]);
      if (!active) return;
      setDevis(d);
      setEntreprise(e);
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [devisId]);

  if (loading) {
    return (
      <div className="apercu-tool">
        <div className="loading">Chargement…</div>
      </div>
    );
  }
  if (!devis) {
    return (
      <div className="apercu-tool">
        <div className="notfound">Devis introuvable.</div>
      </div>
    );
  }

  const ent = entreprise;
  const cli = devis.clientSnapshot;
  const totaux = calcDevisTotaux(devis.lots, devis.remiseMode, devis.remiseValeur);
  const ventil = ventilationTVA(devis.lots, devis.remiseMode, devis.remiseValeur);
  const acompte = montantAcompte({
    totalTTC: totaux.totalTTC,
    acomptePct: devis.acomptePct,
  });
  const solde = round2(totaux.totalTTC - acompte);

  const isParticulier = cli?.type === "particulier";
  const hasTVA55 = devis.lots.some((l) =>
    l.lignes.some((g) => g.tva === 5.5)
  );
  const isGratuit = totaux.totalTTC < SEUIL_GRATUIT_TTC;
  const today = formatDateFR(new Date().toISOString().slice(0, 10));
  const raison = ent?.raisonSociale || "Votre entreprise";

  const clientNom = cli
    ? cli.type === "professionnel"
      ? cli.nom
      : [cli.prenom, cli.nom].filter(Boolean).join(" ").trim() || cli.nom
    : "—";

  const entConfigured = Boolean(ent && ent.raisonSociale);

  // Lignes "option" éventuelles, à signaler hors total.
  const optionLines = devis.lots.flatMap((l, li) =>
    l.lignes
      .filter((g) => g.nature === "option")
      .map((g, gi) => ({ num: `${li + 1}.${l.lignes.indexOf(g) + 1}`, g, gi }))
  );

  return (
    <div className="apercu-tool">
      {/* Barre d'actions (non imprimée) */}
      <div className="toolbar">
        <Link href="/chantier/devis" className="btn-back">
          Retour
        </Link>
        <button className="btn-print" onClick={() => window.print()}>
          <i className="ti ti-printer" aria-hidden="true" />
          Imprimer
        </button>
      </div>

      {!entConfigured && (
        <div className="config-warn">
          Renseignez vos informations d&apos;entreprise dans Paramètres pour un
          devis complet (coordonnées, assurance, IBAN, CGV).
        </div>
      )}

      <div className="sheet">
        {/* EN-TÊTE */}
        <div className="doc-head">
          <div>
            <div className="ent-name">{raison}</div>
            {ent?.formeJuridique && (
              <div className="ent-line">
                {ent.formeJuridique}
                {ent.capital ? ` · Capital ${formatEuro(ent.capital)}` : ""}
              </div>
            )}
            {(ent?.adresse || ent?.ville) && (
              <div className="ent-line">
                {[ent?.adresse, [ent?.codePostal, ent?.ville].filter(Boolean).join(" ")]
                  .filter(Boolean)
                  .join(" · ")}
              </div>
            )}
            {(ent?.email || ent?.telephone) && (
              <div className="ent-line">
                {[ent?.email, ent?.telephone].filter(Boolean).join(" · ")}
              </div>
            )}
            {(ent?.siren || ent?.siret || ent?.tvaIntracom) && (
              <div className="ent-line">
                {[
                  ent?.siren && `SIREN ${ent.siren}`,
                  ent?.siret && `SIRET ${ent.siret}`,
                  ent?.tvaIntracom && `TVA ${ent.tvaIntracom}`,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </div>
            )}
            {ent?.assuranceCompagnie && (
              <div className="ent-line">
                Décennale {ent.assuranceCompagnie}
                {ent.assurancePolice ? ` · police ${ent.assurancePolice}` : ""}
                {ent.assuranceZone ? ` · ${ent.assuranceZone}` : ""}
              </div>
            )}
          </div>

          <div className="cli-block">
            <div className="cli-label">À l&apos;attention de</div>
            <div className="cli-name">{clientNom}</div>
            {cli?.type === "professionnel" && cli.contact && (
              <div className="cli-line">{cli.contact}</div>
            )}
            {cli && (cli.adresse || cli.ville) && (
              <div className="cli-line">
                {[cli.adresse, [cli.codePostal, cli.ville].filter(Boolean).join(" ")]
                  .filter(Boolean)
                  .join(", ")}
              </div>
            )}
            {cli && (cli.email || cli.telephone) && (
              <div className="cli-line">
                {[cli.email, cli.telephone].filter(Boolean).join(" · ")}
              </div>
            )}
            {(devis.chantierAdresse || devis.chantierVille) && (
              <div className="cli-chantier">
                Chantier :{" "}
                {[
                  devis.chantierAdresse,
                  [devis.chantierCodePostal, devis.chantierVille]
                    .filter(Boolean)
                    .join(" "),
                ]
                  .filter(Boolean)
                  .join(", ")}
              </div>
            )}
          </div>
        </div>

        {/* BANDEAU DEVIS */}
        <div className="doc-meta">
          <div className="doc-numero">DEVIS {devis.numero}</div>
          <div className="doc-titre">{devis.titre || "Devis"}</div>
          <div className="doc-dates">
            Émis le {formatDateFR(devis.dateCreation)}
            {devis.dateValidite
              ? ` · Valable jusqu'au ${formatDateFR(devis.dateValidite)}`
              : ""}
          </div>
        </div>

        {devis.lettreIntro && <div className="doc-intro">{devis.lettreIntro}</div>}

        {/* RÉCAPITULATIF (avant le détail) */}
        <div className="sec-title">Récapitulatif</div>
        {devis.lots.map((lot, li) => (
          <div className="recap-row" key={lot.id}>
            <span>
              <span className="num">{li + 1}.0</span>
              {lot.titre || `Lot ${li + 1}`}
            </span>
            <span className="amt">
              {formatEuro(calcDevisTotaux([lot]).subTotalHT)} HT
            </span>
          </div>
        ))}
        <div className="recap-total">
          <span>Total HT</span>
          <span className="amt">{formatEuro(totaux.totalHT)}</span>
        </div>

        {/* DÉTAIL */}
        <div className="sec-title">Détail</div>
        {devis.lots.map((lot, li) => (
          <div className="lot-detail" key={lot.id}>
            <div className="lot-detail-head">
              <span className="num">{li + 1}</span>
              {lot.titre || `Lot ${li + 1}`}
            </div>
            <table className="lignes">
              <tbody>
                {lot.lignes.map((g, gi) => {
                  const brut = ligneBrutHT(g);
                  return (
                    <tr key={g.id}>
                      <td className="l-num">
                        {li + 1}.{gi + 1}
                      </td>
                      <td className="l-desc">
                        <div>
                          {g.libelle || "—"}
                          {g.nature === "option" && <span className="tag">Option</span>}
                        </div>
                        {g.description && <div className="d">{g.description}</div>}
                      </td>
                      <td className="l-qty">
                        {g.quantite} {g.unite} ×{" "}
                        {formatEuro(g.prixMateriauxUnitaire + g.prixPoseUnitaire)}
                      </td>
                      <td className="l-tva">{g.tva} %</td>
                      <td className="l-amt">{formatEuro(brut)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <div className="lot-soustotal">
              <span>Sous-total lot {li + 1}</span>
              <span className="amt">
                {formatEuro(calcDevisTotaux([lot]).subTotalHT)} HT
              </span>
            </div>
          </div>
        ))}

        {optionLines.length > 0 && (
          <div className="options-note">
            Options proposées (hors total) :{" "}
            {optionLines
              .map((o) => `${o.num} ${o.g.libelle} — ${formatEuro(ligneBrutHT(o.g))} HT`)
              .join(" · ")}
          </div>
        )}

        {/* TOTAUX */}
        <div className="totaux">
          <div className="tot-row">
            <span className="l">Total HT</span>
            <span className="v">{formatEuro(totaux.totalHT)}</span>
          </div>
          {Object.keys(ventil)
            .map(Number)
            .sort((a, b) => a - b)
            .map((t) => (
              <div className="tot-row sub" key={t}>
                <span className="l">dont TVA {t} %</span>
                <span className="v">{formatEuro(ventil[t])}</span>
              </div>
            ))}
          <div className="tot-row">
            <span className="l">Total TVA</span>
            <span className="v">{formatEuro(totaux.totalTVA)}</span>
          </div>
          <div className="tot-ttc">
            <span>Total TTC</span>
            <span className="v">{formatEuro(totaux.totalTTC)}</span>
          </div>
          <div className="tot-row acompte">
            <span className="l">Acompte {devis.acomptePct} % à la signature</span>
            <span className="v">{formatEuro(acompte)}</span>
          </div>
          <div className="tot-row">
            <span className="l">Solde à l&apos;achèvement</span>
            <span className="v">{formatEuro(solde)}</span>
          </div>
        </div>

        {/* MENTIONS LÉGALES */}
        <div className="mentions">
          {devis.dateValidite && (
            <p>
              Devis valable jusqu&apos;au {formatDateFR(devis.dateValidite)}.
              Au-delà, les prix sont susceptibles d&apos;être réévalués.
            </p>
          )}
          <p>
            Prix exprimés en euros. TVA applicable aux taux en vigueur, indiqués
            pour chaque ligne.
          </p>
          <p>
            Modalités de règlement : acompte de {devis.acomptePct} % soit{" "}
            {formatEuro(acompte)} TTC à la signature, solde de {formatEuro(solde)}{" "}
            TTC à l&apos;achèvement des travaux. Règlement par virement (IBAN
            ci-dessous) ou chèque à l&apos;ordre de {raison}.
          </p>
          <p>
            Pénalités de retard : en cas de retard de paiement, des pénalités sont
            exigibles au taux d&apos;intérêt légal majoré de 10 points. Pour les
            clients professionnels, une indemnité forfaitaire de 40 € pour frais
            de recouvrement est due (article D441-5 du Code de commerce).
          </p>
          <p>
            {raison} est titulaire d&apos;une assurance de responsabilité civile
            professionnelle et décennale
            {ent?.assuranceCompagnie ? ` auprès de ${ent.assuranceCompagnie}` : ""}
            {ent?.assurancePolice ? ` (police n° ${ent.assurancePolice})` : ""}
            {ent?.assuranceZone ? `, valable pour ${ent.assuranceZone}` : ""}.
          </p>
          {isParticulier && (
            <p>
              Conformément aux articles L.221-18 et suivants du Code de la
              consommation, pour tout contrat conclu hors établissement, le client
              dispose d&apos;un délai de rétractation de quatorze (14) jours à
              compter de sa signature.
            </p>
          )}
          {hasTVA55 && (
            <p>
              Le taux de TVA de 5,5 % s&apos;applique aux travaux d&apos;amélioration
              de la qualité énergétique (art. 278-0 bis A du CGI). Le client atteste
              que le logement est achevé depuis plus de deux ans et s&apos;engage à
              signer l&apos;attestation correspondante.
            </p>
          )}
          <p>
            Le présent devis est régi par les conditions générales de vente
            annexées.
          </p>
          {isGratuit && (
            <p className="gratuit">
              Devis gratuit — l&apos;établissement du présent devis est gratuit et
              ne constitue pas un engagement de la part du client.
            </p>
          )}
          {ent?.iban && (
            <div className="iban-line">
              Coordonnées bancaires — IBAN : <span className="v">{ent.iban}</span>
            </div>
          )}
        </div>

        {/* SIGNATURES */}
        <div className="signatures">
          <div className="sign-box">
            <div className="sign-title">L&apos;entreprise</div>
            <div className="sign-line">
              <strong>{raison}</strong>
            </div>
            <div className="sign-line">
              Fait à {ent?.ville || "…"}, le {today}
            </div>
            <div className="sign-line">Signature :</div>
          </div>
          <div className="sign-box">
            <div className="sign-title">Le client</div>
            <div className="sign-line">
              <strong>« Bon pour accord, devis reçu »</strong>
            </div>
            <div className="sign-line">Date :</div>
            <div className="sign-line">Signature :</div>
          </div>
        </div>

        {/* ANNEXE CGV */}
        {ent?.cgv && (
          <div className="mentions">
            <div className="sec-title">Conditions générales de vente</div>
            <p style={{ whiteSpace: "pre-wrap" }}>{ent.cgv}</p>
          </div>
        )}
      </div>
    </div>
  );
}

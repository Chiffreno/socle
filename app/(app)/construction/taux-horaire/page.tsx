"use client";

import { useMemo, useState } from "react";
import ComparaisonMarche from "@/components/taux-horaire/ComparaisonMarche";
import {
  computeComparaison,
  REGIMES,
  REGIME_INFO,
  type Assiette,
  type Regime,
} from "@/lib/taux-horaire";
import "./taux-horaire.css";

type NfItem = {
  days: number;
  name: string;
  desc: string;
  daysLabel: string;
  active: boolean;
};

const INITIAL_NF: NfItem[] = [
  {
    days: 3,
    name: "Devis, préparation de chantier",
    desc: "Métrés, estimations, appels clients, visites techniques non payées",
    daysLabel: "~3 j/mois",
    active: true,
  },
  {
    days: 1,
    name: "SAV et reprises",
    desc: "Retours sur chantier, corrections, garanties exercées",
    daysLabel: "~1 j/mois",
    active: true,
  },
  {
    days: 1,
    name: "Administration et comptabilité",
    desc: "Factures fournisseurs, déclarations, suivi de trésorerie",
    daysLabel: "~1 j/mois",
    active: true,
  },
  {
    days: 2,
    name: "Déplacements non facturés",
    desc: "Trajets chantier-fournisseur, livraisons, reconnaissance de site",
    daysLabel: "~2 j/mois",
    active: false,
  },
  {
    days: 1,
    name: "Prospection et formation",
    desc: "Recherche de clients, réseautage, montée en compétences",
    daysLabel: "~1 j/mois",
    active: false,
  },
  {
    days: 1,
    name: "Pannes, intempéries, imprévus",
    desc: "Chantiers décalés, matériaux attendus, mauvais temps",
    daysLabel: "~1 j/mois",
    active: false,
  },
];

type Charges = {
  vehicule: number;
  assurance: number;
  outils: number;
  compta: number;
  divers: number;
};

const CHARGE_ROWS: { key: keyof Charges; name: string; step: number }[] = [
  { key: "vehicule", name: "Véhicule (leasing, carburant, assurance)", step: 50 },
  { key: "assurance", name: "RC Pro + Garantie décennale", step: 10 },
  { key: "outils", name: "Outillage et consommables", step: 10 },
  { key: "compta", name: "Expert-comptable", step: 10 },
  { key: "divers", name: "Téléphone, logiciels, divers", step: 10 },
];

/** Libellé FR de la base d'assiette des cotisations, pour le détail. */
const ASSIETTE_LABEL: Record<Assiette, string> = {
  ca: "sur le chiffre d'affaires",
  benefice: "sur le bénéfice",
  salaire: "sur le salaire",
};

/** Libellés courts pour les onglets. */
const REGIME_TAB_LABELS: Record<Regime, string> = {
  micro: "Micro",
  ei_reel: "EI réel",
  eurl: "EURL",
  sasu: "SASU",
};

const fmt = (v: number) => Math.round(v).toLocaleString("fr-FR");

export default function TauxHorairePage() {
  const [salaire, setSalaire] = useState<number>(2500);
  const [conges, setConges] = useState<number>(5);
  const [joursSemaine, setJoursSemaine] = useState<number>(5);
  const [nfItems, setNfItems] = useState<NfItem[]>(INITIAL_NF);
  const [charges, setCharges] = useState<Charges>({
    vehicule: 600,
    assurance: 200,
    outils: 150,
    compta: 100,
    divers: 80,
  });
  const [acre, setAcre] = useState<boolean>(false);
  // Onglet régime actif — point d'entrée neutre (micro), pas une recommandation.
  const [regimeActif, setRegimeActif] = useState<Regime>("micro");
  const [detailOpen, setDetailOpen] = useState<boolean>(false);
  const [nfOpen, setNfOpen] = useState<boolean>(false);
  const [chargesOpen, setChargesOpen] = useState<boolean>(false);

  const nfDays = useMemo(
    () => nfItems.reduce((s, it) => s + (it.active ? it.days : 0), 0),
    [nfItems]
  );

  const chargesTotal = useMemo(
    () =>
      charges.vehicule +
      charges.assurance +
      charges.outils +
      charges.compta +
      charges.divers,
    [charges]
  );

  // SOURCE UNIQUE : tout le calcul vient de lib/taux-horaire.
  const comparaison = useMemo(
    () =>
      computeComparaison({
        salaire,
        chargesFixes: chargesTotal,
        conges,
        nfDays,
        joursSemaine,
        acre,
      }),
    [salaire, chargesTotal, conges, nfDays, joursSemaine, acre]
  );

  // Données communes (indépendantes du régime) pour l'alerte et le détail.
  const joursOuvres = (52 - conges) * joursSemaine;
  const joursNFAn = nfDays * 12;
  const joursFact = Math.max(joursOuvres - joursNFAn, 1);
  const jFMois = Math.round((joursFact / 12) * 10) / 10;
  const hoursAlertVisible = joursFact < 130;

  const res = comparaison[regimeActif];
  const info = REGIME_INFO[regimeActif];

  const toggleNF = (index: number) =>
    setNfItems((prev) =>
      prev.map((it, i) => (i === index ? { ...it, active: !it.active } : it))
    );

  const handleSalaire = (raw: string) => setSalaire(parseInt(raw) || 0);
  const handleConges = (raw: string) => setConges(parseInt(raw) || 0);
  const handleJoursSemaine = (raw: string) => setJoursSemaine(parseInt(raw) || 5);
  const handleCharge = (key: keyof Charges, raw: string) =>
    setCharges((prev) => ({ ...prev, [key]: parseFloat(raw) || 0 }));

  return (
    <div className="taux-tool">
      <div className="page-header">
        <div className="page-eyebrow">Prix &amp; Marges · Étape 1</div>
        <h1 className="page-title">Ton prix jour viable</h1>
        <p className="page-sub">
          Ce que tu dois facturer à la journée pour couvrir tes charges et te
          verser le salaire que tu veux — comparé selon ton statut juridique. La
          base de tous tes devis.
        </p>
      </div>

      {/* ── 1. VARIABLES — barre compacte ── */}
      <section className="vars">
        <div className="vars-grid">
          <div className="var-cell">
            <div className="var-label">
              Salaire net visé
              <span className="var-val">{fmt(salaire)} €/mois</span>
            </div>
            <input
              type="range"
              className="input-slider var-slider"
              min={1000}
              max={6000}
              step={100}
              value={salaire}
              onInput={(e) => handleSalaire(e.currentTarget.value)}
              onChange={(e) => handleSalaire(e.currentTarget.value)}
            />
          </div>

          <div className="var-cell">
            <div className="var-label">
              Congés annuels
              <span className="var-val">
                {conges} sem.
              </span>
            </div>
            <input
              type="range"
              className="input-slider var-slider"
              min={2}
              max={10}
              step={1}
              value={conges}
              onInput={(e) => handleConges(e.currentTarget.value)}
              onChange={(e) => handleConges(e.currentTarget.value)}
            />
          </div>

          <div className="var-cell">
            <div className="var-label">
              Jours travaillés / semaine
              <span className="var-val">{joursSemaine} j/sem</span>
            </div>
            <input
              type="range"
              className="input-slider var-slider"
              min={4}
              max={6}
              step={1}
              value={joursSemaine}
              onInput={(e) => handleJoursSemaine(e.currentTarget.value)}
              onChange={(e) => handleJoursSemaine(e.currentTarget.value)}
            />
          </div>

          <button
            className={`var-cell var-collapse${nfOpen ? " open" : ""}`}
            onClick={() => setNfOpen((o) => !o)}
            aria-expanded={nfOpen}
          >
            <span className="var-label">Jours non facturables</span>
            <span className="var-collapse-row">
              <span className="var-val">
                {nfDays} j/mois
              </span>
              <i className="ti ti-chevron-down var-chevron" aria-hidden="true"></i>
            </span>
          </button>

          <button
            className={`var-cell var-collapse${chargesOpen ? " open" : ""}`}
            onClick={() => setChargesOpen((o) => !o)}
            aria-expanded={chargesOpen}
          >
            <span className="var-label">Charges fixes</span>
            <span className="var-collapse-row">
              <span className="var-val">{fmt(chargesTotal)} €/mois</span>
              <i className="ti ti-chevron-down var-chevron" aria-hidden="true"></i>
            </span>
          </button>

          <button
            className={`var-cell acre-toggle${acre ? " active" : ""}`}
            onClick={() => setAcre((a) => !a)}
            aria-pressed={acre}
          >
            <span className="acre-check">
              <i className="ti ti-check" aria-hidden="true"></i>
            </span>
            <span className="acre-info">
              <span className="acre-name">ACRE (année 1)</span>
              <span className="acre-desc">Cotisations réduites</span>
            </span>
          </button>
        </div>

        {nfOpen && (
          <div className="var-panel">
            <div className="var-panel-sub">
              Ces jours, tu travailles mais tu ne factures pas. Coche ce qui
              s&apos;applique à ton activité.
            </div>
            <div className="nf-items">
              {nfItems.map((item, i) => (
                <div
                  key={item.name}
                  className={`nf-item${item.active ? " active" : ""}`}
                  onClick={() => toggleNF(i)}
                >
                  <div className="nf-check">
                    <i className="ti ti-check" aria-hidden="true"></i>
                  </div>
                  <div className="nf-info">
                    <div className="nf-name">{item.name}</div>
                    <div className="nf-desc">{item.desc}</div>
                  </div>
                  <div className="nf-days">{item.daysLabel}</div>
                </div>
              ))}
            </div>
            <div className="nf-total">
              <span className="nf-total-label">Jours non facturables / mois</span>
              <span className="nf-total-val">
                {nfDays} jour{nfDays > 1 ? "s" : ""}
              </span>
            </div>
          </div>
        )}

        {chargesOpen && (
          <div className="var-panel">
            <div className="var-panel-sub">
              Tout ce que tu paies chaque mois, que tu travailles ou non.
            </div>
            <div className="charges-list">
              {CHARGE_ROWS.map((row) => (
                <div className="charge-row" key={row.key}>
                  <span className="charge-name">{row.name}</span>
                  <input
                    type="number"
                    className="charge-input"
                    value={charges[row.key]}
                    min={0}
                    step={row.step}
                    onChange={(e) => handleCharge(row.key, e.currentTarget.value)}
                  />
                  <span className="charge-unit">€</span>
                </div>
              ))}
            </div>
            <div className="charges-total">
              <span className="charges-total-label">
                Total charges fixes / mois
              </span>
              <span className="charges-total-val">{fmt(chargesTotal)} €</span>
            </div>
          </div>
        )}
      </section>

      {hoursAlertVisible && (
        <div className="hours-alert visible">
          {`⚠ Attention : tu n'as que ${joursFact} jours facturables par an (${jFMois}/mois). C'est très bas — vérifie tes jours non facturables et tes congés.`}
        </div>
      )}

      {/* ── 2. COMPARATEUR 4 RÉGIMES — onglets ── */}
      <section className="regime-section">
        <div className="regime-tabs" role="tablist">
          {REGIMES.map((r) => (
            <button
              key={r}
              role="tab"
              aria-selected={regimeActif === r}
              className={`regime-tab${regimeActif === r ? " active" : ""}`}
              onClick={() => setRegimeActif(r)}
            >
              {REGIME_TAB_LABELS[r]}
            </button>
          ))}
        </div>

        <div className="regime-active">
          <div className="regime-active-head">
            <span className="regime-active-name">{info.label}</span>
            <span className="regime-active-assiette">
              cotisations {ASSIETTE_LABEL[res.assiette]}
            </span>
          </div>

          <div className="regime-active-price">
            <span className="regime-active-num">{fmt(res.prixJourReco)}</span>
            <span className="regime-active-unit">€/j</span>
          </div>
          <div className="regime-active-tagline">
            Prix jour recommandé — marge +20 % sur le minimum viable, pour
            absorber les imprévus.
          </div>

          <div className="regime-active-sub">
            <div className="regime-active-sub-item">
              <span className="regime-active-sub-label">Minimum viable</span>
              <span className="regime-active-sub-val">
                {fmt(res.prixJourMin)} €/j
              </span>
            </div>
            <div className="regime-active-sub-item">
              <span className="regime-active-sub-label">Technique / urgence</span>
              <span className="regime-active-sub-val">
                {fmt(res.prixJourTech)} €/j
              </span>
            </div>
          </div>

          <div className="regime-active-desc">{info.description}</div>

          {info.avertissement && (
            <div className="regime-warn">
              <i className="ti ti-alert-triangle" aria-hidden="true"></i>
              {info.avertissement}
            </div>
          )}

          <button
            className={`btn-detail${detailOpen ? " open" : ""}`}
            onClick={() => setDetailOpen((o) => !o)}
          >
            <i className="ti ti-chevron-down" aria-hidden="true"></i>
            {detailOpen ? "Masquer le détail" : "Voir le détail du calcul"}
          </button>

          {detailOpen && (
            <div className="detail-panel visible">
              <div className="detail-line">
                <span className="detail-line-label">Salaire net mensuel visé</span>
                <span className="detail-line-val">{fmt(salaire)} €/mois</span>
              </div>
              <div className="detail-line">
                <span className="detail-line-label">
                  Cotisations sociales ({ASSIETTE_LABEL[res.assiette]})
                </span>
                <span className="detail-line-val">
                  {fmt(res.cotisationsMensuelles)} €/mois
                </span>
              </div>
              <div className="detail-line">
                <span className="detail-line-label">Charges fixes mensuelles</span>
                <span className="detail-line-val">{fmt(chargesTotal)} €/mois</span>
              </div>
              <div className="detail-line total">
                <span className="detail-line-label">
                  Coût total mensuel à couvrir
                </span>
                <span className="detail-line-val">
                  {fmt(res.coutMensuel)} €/mois
                </span>
              </div>
              <div className="detail-line total">
                <span className="detail-line-label">
                  Jours réellement facturables/an
                </span>
                <span className="detail-line-val">{joursFact} jours</span>
              </div>
              <div className="detail-line">
                <span className="detail-line-label">
                  Prix jour minimum (coût / jours)
                </span>
                <span className="detail-line-val">{fmt(res.prixJourMin)} €/j</span>
              </div>
              <div className="detail-line">
                <span className="detail-line-label">
                  Prix jour recommandé (×1,20)
                </span>
                <span className="detail-line-val">{fmt(res.prixJourReco)} €/j</span>
              </div>
              <div className="detail-line">
                <span className="detail-line-label">
                  Prix jour technique (×1,40)
                </span>
                <span className="detail-line-val">{fmt(res.prixJourTech)} €/j</span>
              </div>
            </div>
          )}

          <p className="reserves">
            Simulation indicative, pas un calcul comptable. Le taux couvre la
            main-d&apos;œuvre seule ; la matière (fournitures) se refacture
            séparément. Les cotisations TNS (~45 %) sont un ordre de grandeur,
            non linéaire selon le revenu. Le calcul SASU est simplifié
            (rémunération 100 % salaire, hors IS et dividendes).
          </p>
        </div>

        <div className="regime-others">
          {REGIMES.filter((r) => r !== regimeActif).map((r) => (
            <button
              key={r}
              className="regime-other"
              onClick={() => setRegimeActif(r)}
            >
              <span className="regime-other-name">{REGIME_INFO[r].label}</span>
              <span className="regime-other-num">
                {fmt(comparaison[r].prixJourReco)} €/j
              </span>
            </button>
          ))}
        </div>
      </section>

      {/* ── 3. COMPARATIF MÉTIER × ZONE — piloté par l'onglet actif ── */}
      <section className="marche-section">
        <ComparaisonMarche prixJour={res.prixJourReco} />
      </section>
    </div>
  );
}

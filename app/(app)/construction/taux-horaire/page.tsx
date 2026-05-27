"use client";

import { useMemo, useState } from "react";
import "./taux-horaire.css";

type Statut = "micro" | "eurl" | "sasu";

const CHARGES_SOCIALES: Record<Statut, number> = {
  micro: 0.22,
  eurl: 0.45,
  sasu: 0.82,
};

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

const fmt = (v: number) => Math.round(v).toLocaleString("fr-FR");

export default function TauxHorairePage() {
  const [statut, setStatut] = useState<Statut>("sasu");
  const [salaire, setSalaire] = useState<number>(2500);
  const [conges, setConges] = useState<number>(5);
  const [nfItems, setNfItems] = useState<NfItem[]>(INITIAL_NF);
  const [charges, setCharges] = useState<Charges>({
    vehicule: 600,
    assurance: 200,
    outils: 150,
    compta: 100,
    divers: 80,
  });
  const [detailOpen, setDetailOpen] = useState<boolean>(false);

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

  const result = useMemo(() => {
    const taux = CHARGES_SOCIALES[statut];
    const salaireBrut =
      statut === "micro" ? salaire / (1 - taux) : salaire * (1 + taux);
    const coutMensuel = salaireBrut + chargesTotal;
    const coutAnnuel = coutMensuel * 12;
    const joursOuvres = (52 - conges) * 5;
    const joursNFAn = nfDays * 12;
    const joursFact = Math.max(joursOuvres - joursNFAn, 1);
    const heuresFact = joursFact * 7;
    const tauxMin = coutAnnuel / heuresFact;
    const tauxReco = tauxMin * 1.2;
    const tauxTech = tauxMin * 1.4;
    const jFMois = Math.round((joursFact / 12) * 10) / 10;
    const cotisations = Math.round(
      statut === "micro" ? salaireBrut - salaire : salaire * taux
    );
    return {
      taux,
      salaireBrut,
      coutMensuel,
      coutAnnuel,
      joursOuvres,
      joursNFAn,
      joursFact,
      heuresFact,
      tauxMin,
      tauxReco,
      tauxTech,
      jFMois,
      cotisations,
    };
  }, [statut, salaire, conges, nfDays, chargesTotal]);

  const {
    taux,
    coutMensuel,
    joursOuvres,
    joursNFAn,
    joursFact,
    heuresFact,
    tauxMin,
    tauxReco,
    tauxTech,
    jFMois,
    cotisations,
  } = result;

  const hoursAlertVisible = joursFact < 130;
  const tauxAlertVisible = tauxMin > 80;

  const toggleNF = (index: number) => {
    setNfItems((prev) =>
      prev.map((it, i) => (i === index ? { ...it, active: !it.active } : it))
    );
  };

  const handleSalaire = (raw: string) => {
    setSalaire(parseInt(raw) || 0);
  };

  const handleConges = (raw: string) => {
    setConges(parseInt(raw) || 0);
  };

  const handleCharge = (key: keyof Charges, raw: string) => {
    setCharges((prev) => ({ ...prev, [key]: parseFloat(raw) || 0 }));
  };

  return (
    <div className="taux-tool">
      <div className="page-header">
        <div className="page-eyebrow">Prix &amp; Marges · Étape 1</div>
        <h1 className="page-title">Ton taux horaire viable</h1>
        <p className="page-sub">
          Ce que tu dois facturer à l&apos;heure pour couvrir toutes tes charges
          et te verser le salaire que tu veux. La base de tous tes devis.
        </p>
      </div>

      <div className="sim-grid">
        <div className="inputs-col">
          <div className="card">
            <div className="card-title">
              <span className="card-num">01</span>Statut juridique
            </div>
            <div className="card-sub">
              Les cotisations sociales varient fortement selon ton statut — elles
              déterminent une grande partie de ton taux horaire.
            </div>
            <div className="statut-pills">
              <button
                className={`pill-btn${statut === "micro" ? " active" : ""}`}
                onClick={() => setStatut("micro")}
              >
                Micro-entrepreneur
                <span className="pill-btn-sub">~22% de charges</span>
              </button>
              <button
                className={`pill-btn${statut === "eurl" ? " active" : ""}`}
                onClick={() => setStatut("eurl")}
              >
                EURL
                <span className="pill-btn-sub">~45% de charges</span>
              </button>
              <button
                className={`pill-btn${statut === "sasu" ? " active" : ""}`}
                onClick={() => setStatut("sasu")}
              >
                SASU
                <span className="pill-btn-sub">~82% de charges</span>
              </button>
            </div>
          </div>

          <div className="card">
            <div className="card-title">
              <span className="card-num">02</span>Salaire net visé
            </div>
            <div className="card-sub">
              Ce que tu veux réellement toucher chaque mois, après impôts. Sois
              honnête — c&apos;est la base de tout le calcul.
            </div>
            <div className="field">
              <div className="field-label">
                Salaire net visé
                <span className="field-label-hint">
                  {salaire.toLocaleString("fr-FR")} €/mois
                </span>
              </div>
              <div className="input-row">
                <input
                  type="range"
                  className="input-slider"
                  min={1000}
                  max={6000}
                  step={100}
                  value={salaire}
                  onInput={(e) => handleSalaire(e.currentTarget.value)}
                  onChange={(e) => handleSalaire(e.currentTarget.value)}
                />
                <input
                  type="number"
                  className="input-num"
                  value={salaire}
                  min={500}
                  max={10000}
                  step={100}
                  onChange={(e) => handleSalaire(e.currentTarget.value)}
                />
                <span className="input-suffix">€/mois</span>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-title">
              <span className="card-num">03</span>Congés annuels
            </div>
            <div className="card-sub">
              Les jours que tu ne travailles pas dans l&apos;année. Plus tu prends
              de congés, moins tu as d&apos;heures pour récupérer tes charges —
              donc ton taux monte.
            </div>
            <div className="field">
              <div className="field-label">
                Semaines de congés par an
                <span className="field-label-hint">
                  {conges} semaine{conges > 1 ? "s" : ""}
                </span>
              </div>
              <div className="input-row">
                <input
                  type="range"
                  className="input-slider"
                  min={2}
                  max={10}
                  step={1}
                  value={conges}
                  onInput={(e) => handleConges(e.currentTarget.value)}
                  onChange={(e) => handleConges(e.currentTarget.value)}
                />
                <input
                  type="number"
                  className="input-num"
                  value={conges}
                  min={1}
                  max={12}
                  step={1}
                  onChange={(e) => handleConges(e.currentTarget.value)}
                />
                <span className="input-suffix">sem.</span>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-title">
              <span className="card-num">04</span>Jours non facturables
            </div>
            <div className="card-sub">
              C&apos;est la variable la plus sous-estimée par les artisans. Ces
              jours tu travailles — mais tu ne factures pas. Coche tout ce qui
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
              <span className="nf-total-label">
                Jours non facturables / mois
              </span>
              <span className="nf-total-val">
                {nfDays} jour{nfDays > 1 ? "s" : ""}
              </span>
            </div>
          </div>

          <div className="card">
            <div className="card-title">
              <span className="card-num">05</span>Charges fixes
            </div>
            <div className="card-sub">
              Tout ce que tu paies chaque mois que tu travailles ou non. Ajuste
              selon ta situation réelle.
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
        </div>

        {/* RÉSULTAT */}
        <div className="result-col">
          <div className="result-card">
            <div className="result-eyebrow">Résultat</div>

            <div className={`taux-alert${tauxAlertVisible ? " visible" : ""}`}>
              <div className="taux-alert-text">
                {tauxAlertVisible &&
                  `Ton taux minimum est élevé. C'est normal avec un statut ${statut.toUpperCase()} et un salaire visé de ${fmt(
                    salaire
                  )} €. Vérifie que tu peux te positionner à ce niveau sur ton marché local.`}
              </div>
            </div>

            <div className="taux-grid">
              <div className="taux-item">
                <div className="taux-label">Taux minimum viable</div>
                <div className="taux-val">
                  {fmt(tauxMin)}
                  <span className="unit"> €/h</span>
                </div>
                <div className="taux-desc">
                  En dessous de ce taux, tu travailles à perte.
                </div>
              </div>
              <div className="taux-item featured">
                <div className="taux-label green">Taux recommandé</div>
                <div className="taux-val">
                  {fmt(tauxReco)}
                  <span className="unit"> €/h</span>
                </div>
                <div className="taux-desc">
                  +20% pour absorber les imprévus. À utiliser pour tes devis
                  standards.
                </div>
              </div>
              <div className="taux-item">
                <div className="taux-label">
                  Taux chantier technique / urgence
                </div>
                <div className="taux-val">
                  {fmt(tauxTech)}
                  <span className="unit"> €/h</span>
                </div>
                <div className="taux-desc">
                  +40% pour les chantiers complexes, les urgences, les conditions
                  difficiles.
                </div>
              </div>
            </div>

            <div className="result-summary">
              Avec{" "}
              <strong>
                {conges} semaine{conges > 1 ? "s" : ""}
              </strong>{" "}
              de congés et <strong>{nfDays} jours/mois</strong> non facturés, tu
              travailles réellement{" "}
              <strong>{jFMois} jours facturables par mois</strong> — soit{" "}
              <strong>{fmt(heuresFact)} heures par an</strong>. Pour couvrir ton
              salaire net de <em>{fmt(salaire)} €</em> et tes charges, tu dois
              facturer au minimum <em>{fmt(tauxMin)} €/h</em>.
            </div>

            <div className={`hours-alert${hoursAlertVisible ? " visible" : ""}`}>
              {hoursAlertVisible &&
                `⚠ Attention : tu n'as que ${joursFact} jours facturables par an (${jFMois}/mois). C'est très bas — vérifies tes jours non facturables et tes congés.`}
            </div>

            <button
              className={`btn-detail${detailOpen ? " open" : ""}`}
              onClick={() => setDetailOpen((o) => !o)}
            >
              <i className="ti ti-chevron-down" aria-hidden="true"></i>
              Voir le détail du calcul
            </button>

            <div className={`detail-panel${detailOpen ? " visible" : ""}`}>
              <div className="detail-line">
                <span className="detail-line-label">
                  Salaire net mensuel visé
                </span>
                <span className="detail-line-val">{fmt(salaire)} €/mois</span>
              </div>
              <div className="detail-line">
                <span className="detail-line-label">
                  Cotisations sociales ({Math.round(taux * 100)}%)
                </span>
                <span className="detail-line-val">
                  {fmt(cotisations)} €/mois
                </span>
              </div>
              <div className="detail-line">
                <span className="detail-line-label">
                  Charges fixes mensuelles
                </span>
                <span className="detail-line-val">{fmt(chargesTotal)} €/mois</span>
              </div>
              <div className="detail-line total">
                <span className="detail-line-label">
                  Coût total mensuel à couvrir
                </span>
                <span className="detail-line-val">
                  {fmt(Math.round(coutMensuel))} €/mois
                </span>
              </div>
              <div className="detail-line">
                <span className="detail-line-label">
                  Jours ouvrés/an (hors congés)
                </span>
                <span className="detail-line-val">{joursOuvres} jours</span>
              </div>
              <div className="detail-line">
                <span className="detail-line-label">
                  Jours non facturables/an
                </span>
                <span className="detail-line-val">{joursNFAn} jours</span>
              </div>
              <div className="detail-line">
                <span className="detail-line-label">
                  Jours réellement facturables/an
                </span>
                <span className="detail-line-val">{joursFact} jours</span>
              </div>
              <div className="detail-line total">
                <span className="detail-line-label">
                  Heures facturables/an (×7h/j)
                </span>
                <span className="detail-line-val">{heuresFact} heures</span>
              </div>
              <div className="detail-line">
                <span className="detail-line-label">
                  Taux minimum (coût / heures)
                </span>
                <span className="detail-line-val">{fmt(tauxMin)} €/h</span>
              </div>
              <div className="detail-line">
                <span className="detail-line-label">
                  Taux recommandé (×1,20)
                </span>
                <span className="detail-line-val">{fmt(tauxReco)} €/h</span>
              </div>
              <div className="detail-line">
                <span className="detail-line-label">Taux technique (×1,40)</span>
                <span className="detail-line-val">{fmt(tauxTech)} €/h</span>
              </div>
            </div>

            <button
              className="btn-inject"
              onClick={() =>
                alert(
                  "Taux injecté dans le calculateur de rentabilité.\n(À connecter via Supabase)"
                )
              }
            >
              <i className="ti ti-arrow-right" aria-hidden="true"></i>
              Utiliser dans le calculateur de rentabilité
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

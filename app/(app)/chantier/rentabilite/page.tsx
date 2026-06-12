"use client";

import { useState } from "react";
import "./rentabilite.css";

// Helpers de formatage (préservés à l'identique)
function f(n: number, d = 2): string {
  return (
    n.toLocaleString("fr-FR", {
      minimumFractionDigits: d,
      maximumFractionDigits: d,
    }) + " €"
  );
}
function p(n: number): string {
  return n.toFixed(1) + " %";
}

// Coefficient de frais généraux gardé : 1 + charges/(CA - charges).
// Neutralisé à 1 (pas de majoration) si charges ≥ CA — sinon le coef
// divergerait (÷0) ou deviendrait négatif. Garde factorisée et unique.
function coeffOf(ch: number, ca: number): number {
  return ca <= ch ? 1 : 1 + ch / (ca - ch);
}

type Mode = "c" | "i";

const DEFAULTS = {
  nom: "Rénovation RDC – La Ferté",
  m_go: 2200,
  m_rev: 1500,
  m_pei: 1120,
  p_go: 5,
  p_rev: 12,
  p_pei: 10,
  jours: 12,
  ouv: 1,
  taux: 32,
  prod: 80,
  majo: 0,
  buf: 15,
  f_dep: 18,
  f_con: 12,
  f_loc: 0,
  f_ben: 280,
  f_st: 0,
  cfg: 1.305,
  marge: 30,
  tva: "10",
  pv_c: 11000,
  fg_ch: 18000,
  fg_ca: 95000,
};

export default function RentabilitePage() {
  const [mode, setMode] = useState<Mode>("c");
  const [nom, setNom] = useState(DEFAULTS.nom);

  // Matériaux
  const [mGo, setMGo] = useState(DEFAULTS.m_go);
  const [mRev, setMRev] = useState(DEFAULTS.m_rev);
  const [mPei, setMPei] = useState(DEFAULTS.m_pei);
  const [pGo, setPGo] = useState(DEFAULTS.p_go);
  const [pRev, setPRev] = useState(DEFAULTS.p_rev);
  const [pPei, setPPei] = useState(DEFAULTS.p_pei);

  // Main d'œuvre
  const [jours, setJours] = useState(DEFAULTS.jours);
  const [ouvRaw, setOuvRaw] = useState(DEFAULTS.ouv);
  const [taux, setTaux] = useState(DEFAULTS.taux);
  const [prod, setProd] = useState(DEFAULTS.prod);
  const [majo, setMajo] = useState(DEFAULTS.majo);
  const [buf, setBuf] = useState(DEFAULTS.buf);

  // Frais divers
  const [fDep, setFDep] = useState(DEFAULTS.f_dep);
  const [fCon, setFCon] = useState(DEFAULTS.f_con);
  const [fLoc, setFLoc] = useState(DEFAULTS.f_loc);
  const [fBen, setFBen] = useState(DEFAULTS.f_ben);
  const [fSt, setFSt] = useState(DEFAULTS.f_st);

  // Paramètres entreprise
  const [cfgRaw, setCfgRaw] = useState(DEFAULTS.cfg);
  const [marge, setMarge] = useState(DEFAULTS.marge);
  const [tva, setTva] = useState(DEFAULTS.tva);

  // Prix client (mode i)
  const [pvC, setPvC] = useState(DEFAULTS.pv_c);

  // Accordéon frais généraux
  const [fgOpen, setFgOpen] = useState(false);
  const [fgCh, setFgCh] = useState(DEFAULTS.fg_ch);
  const [fgCa, setFgCa] = useState(DEFAULTS.fg_ca);
  // cfgRaw appartient-il au calculateur FG ? Si oui, l'édition des inputs FG
  // resynchronise cfgRaw (évite un coef périmé après correction des hypothèses).
  // La saisie directe du coef libère cette propriété : on n'écrase jamais une
  // valeur tapée à la main.
  const [cfgFromFg, setCfgFromFg] = useState(false);

  // ─── Coefficient FG calculé (cf. coeffOf) ───
  // fgInvalid : charges ≥ CA → coef neutralisé à 1 + alerte (faux-fond évité).
  const fgInvalid = fgCa <= fgCh;
  const fgCoeff = coeffOf(fgCh, fgCa);

  function calcFG() {
    setCfgRaw(parseFloat(fgCoeff.toFixed(3)));
    setCfgFromFg(true);
  }
  function togFG() {
    setFgOpen((o) => !o);
    calcFG();
  }
  function setFG(ch: number, ca: number) {
    setFgCh(ch);
    setFgCa(ca);
    setCfgRaw(parseFloat(coeffOf(ch, ca).toFixed(3)));
    setCfgFromFg(true);
  }
  // Édition des inputs FG : met à jour l'input ET resync cfgRaw si l'accordéon
  // possède la valeur (sinon on laisse intacte une saisie manuelle du coef).
  function editFgCh(v: number) {
    setFgCh(v);
    if (cfgFromFg) setCfgRaw(parseFloat(coeffOf(v, fgCa).toFixed(3)));
  }
  function editFgCa(v: number) {
    setFgCa(v);
    if (cfgFromFg) setCfgRaw(parseFloat(coeffOf(fgCh, v).toFixed(3)));
  }

  function reset() {
    setNom("Nouveau chantier");
    setMGo(DEFAULTS.m_go);
    setMRev(DEFAULTS.m_rev);
    setMPei(DEFAULTS.m_pei);
    setPGo(DEFAULTS.p_go);
    setPRev(DEFAULTS.p_rev);
    setPPei(DEFAULTS.p_pei);
    setJours(DEFAULTS.jours);
    setOuvRaw(DEFAULTS.ouv);
    setTaux(DEFAULTS.taux);
    setProd(DEFAULTS.prod);
    setMajo(DEFAULTS.majo);
    setBuf(DEFAULTS.buf);
    setFDep(DEFAULTS.f_dep);
    setFCon(DEFAULTS.f_con);
    setFLoc(DEFAULTS.f_loc);
    setFBen(DEFAULTS.f_ben);
    setFSt(DEFAULTS.f_st);
    setCfgRaw(DEFAULTS.cfg);
    setCfgFromFg(false);
    setMarge(DEFAULTS.marge);
    setTva(DEFAULTS.tva);
    setMode("c");
  }

  // ============================================================
  // calc() — toutes les formules préservées à l'identique
  // ============================================================
  const m_go = mGo || 0;
  const m_rev = mRev || 0;
  const m_pei = mPei || 0;
  const p_go = pGo || 0;
  const p_rev = pRev || 0;
  const p_pei = pPei || 0;
  const t_go = m_go * (1 + p_go / 100);
  const t_rev = m_rev * (1 + p_rev / 100);
  const t_pei = m_pei * (1 + p_pei / 100);
  const mat_brut = m_go + m_rev + m_pei;
  const mat = t_go + t_rev + t_pei;

  const joursV = jours || 0;
  const ouv = ouvRaw || 1;
  const tauxV = taux || 0;
  const prodV = prod || 80;
  const majoV = majo || 0;
  const bufV = buf || 0;
  const jr = joursV * (1 + bufV / 100);
  const mo = jr * 8 * ouv * (prodV / 100) * tauxV * (1 + majoV / 100);

  const fd = fDep || 0;
  const fc = fCon || 0;
  const fl = fLoc || 0;
  const fb = fBen || 0;
  const fs = fSt || 0;
  const td = fd * jr;
  const tc = fc * jr;
  const tl = fl * jr;
  const frais = td + tc + tl + fb + fs;

  const cfg = cfgRaw || 1.305;
  const mobj = marge || 30;
  const tva_t = parseFloat(tva) || 10;
  const ds = mat + mo + frais;
  const pr = ds * cfg;
  const cben = 1 / (1 - mobj / 100);

  let pv: number;
  let mr: number;
  if (mode === "c") {
    pv = pr * cben;
    mr = ((pv - pr) / pv) * 100;
  } else {
    pv = pvC || 0;
    mr = pv > 0 ? ((pv - pr) / pv) * 100 : 0;
  }

  // Verdict prix client (mode i)
  let pvcBg = "";
  let pvcColor = "";
  let pvcText = "";
  if (mode === "i") {
    if (pv <= pr) {
      pvcBg = "var(--red-bg)";
      pvcColor = "var(--red)";
      pvcText = "✗ Insuffisant — en dessous du prix de revient (" + f(pr, 0) + ")";
    } else if (mr < 15) {
      pvcBg = "var(--orange-bg)";
      pvcColor = "var(--orange)";
      pvcText = "⚠ Marge très faible : " + p(mr) + "  — risque élevé";
    } else if (mr < mobj) {
      pvcBg = "var(--orange-bg)";
      pvcColor = "var(--orange)";
      pvcText = "⚠ Marge de " + p(mr) + " — sous l'objectif de " + mobj + "%";
    } else {
      pvcBg = "var(--green-light)";
      pvcColor = "var(--green)";
      pvcText = "✓ Prix viable — marge de " + p(mr) + " (objectif " + mobj + "%)";
    }
  }

  const mb = pv - pr;
  const fg_m = pr - ds;
  const tvaVal = (pv * tva_t) / 100;
  const ttc = pv + tvaVal;
  const is = mb * 0.15;
  const net = mb - is;

  const pds = pv > 0 ? (ds / pv) * 100 : 0;
  const ppr = pv > 0 ? (pr / pv) * 100 : 0;

  // Badge marge brute (m_mb)
  let mbBg: string;
  let mbColor: string;
  if (mr >= 25) {
    mbBg = "var(--green-light)";
    mbColor = "var(--green)";
  } else if (mr >= 15) {
    mbBg = "var(--orange-bg)";
    mbColor = "var(--orange)";
  } else {
    mbBg = "var(--red-bg)";
    mbColor = "var(--red)";
  }

  // Détail récap calcul
  const cf_mat = "GO: " + f(t_go, 0) + " · Rev: " + f(t_rev, 0) + " · Pei: " + f(t_pei, 0);
  const cf_mo =
    jr.toFixed(1) +
    "j × 8h × " +
    ouv +
    " × " +
    tauxV +
    "€ × " +
    prodV +
    "%" +
    (majoV > 0 ? " × " + (1 + majoV / 100).toFixed(2) : "") +
    (bufV > 0 ? " [buffer +" + bufV + "%]" : "");
  const fd_det =
    [
      td > 0 ? "dep. " + f(td, 0) : null,
      tc > 0 ? "conso. " + f(tc, 0) : null,
      tl > 0 ? "loc. " + f(tl, 0) : null,
      fb > 0 ? "benne " + f(fb, 0) : null,
      fs > 0 ? "ST " + f(fs, 0) : null,
    ]
      .filter(Boolean)
      .join(" · ") || "aucun";
  const cf_fg = f(ds, 0) + " × (" + cfg.toFixed(3) + " − 1)";
  const cf_mb = mode === "c" ? "coeff " + cben.toFixed(3) + " (" + mobj + "% obj.)" : "prix client analysé";
  const cf_pv = mode === "c" ? f(pr, 0) + " × " + cben.toFixed(3) : "prix proposé par le client";

  // Barre de marge
  const bw = Math.min(Math.max((mr / 50) * 100, 0), 100);
  let bc = "#1a7a3c";
  if (mr < 15) bc = "#dc2626";
  else if (mr < 25) bc = "#c45a0a";

  // Verdict principal
  let verdictClass: string;
  let verdictText: string;
  if (fgInvalid) {
    verdictClass = "verdict nok";
    verdictText = "Calcul indisponible — corrigez vos charges / CA annuel estimé.";
  } else if (mr >= 25) {
    verdictClass = "verdict ok";
    verdictText = "✓ Chantier rentable — marge de " + p(mr) + ". Objectif de " + mobj + "% atteint.";
  } else if (mr >= 15) {
    verdictClass = "verdict warn";
    verdictText =
      "⚠ Marge insuffisante (" + p(mr) + "). Objectif " + mobj + "%. Revoyez les postes ou augmentez le prix de vente.";
  } else {
    verdictClass = "verdict nok";
    verdictText = "✗ Chantier non rentable. Marge de " + p(mr) + " pour un objectif de " + mobj + "%.";
  }

  const fmin = Math.max(mr - 22, 0);
  const fmax = Math.max(mr - 12, 0);

  const ratio = mo > 0 && mat > 0 ? mo / mat : 0;
  const ratioColor = ratio >= 0.5 && ratio <= 1.5 ? "var(--green)" : "var(--orange)";

  const lblPv = mode === "i" ? "Prix proposé HT" : "Prix de vente HT";
  const subPv = mode === "i" ? "Saisi par le client" : "Base de référence";

  // Helper pour les inputs numériques (parseFloat || 0 à la lecture, comme g())
  const num = (v: string) => (v === "" ? 0 : parseFloat(v));

  return (
    <div className="renta-tool">
      <div className="container">
        <div className="top-bar">
          <div>
            <div className="chantier-lbl">Nom du chantier</div>
            <input
              className="name-input"
              type="text"
              value={nom}
              onChange={(e) => setNom(e.target.value)}
            />
          </div>
          <button className="btn-reset" onClick={reset}>
            ↺ Réinitialiser
          </button>
        </div>

        {/* 1 MATÉRIAUX */}
        <p className="stitle">1 — Coût matériaux (depuis ChiffReno)</p>
        <div className="card">
          <div className="tbl-hd" style={{ gridTemplateColumns: "1.6fr 1fr 1.4fr 1fr" }}>
            <span style={{ fontSize: 11, color: "var(--gray3)", fontWeight: 600, textTransform: "uppercase", letterSpacing: ".05em" }}>Catégorie</span>
            <span style={{ fontSize: 11, color: "var(--gray3)", fontWeight: 600, textTransform: "uppercase", letterSpacing: ".05em", textAlign: "right" }}>Coût HT</span>
            <span style={{ fontSize: 11, color: "var(--gray3)", fontWeight: 600, textTransform: "uppercase", letterSpacing: ".05em", textAlign: "center" }}>Perte</span>
            <span style={{ fontSize: 11, color: "var(--gray3)", fontWeight: 600, textTransform: "uppercase", letterSpacing: ".05em", textAlign: "right" }}>Total</span>
          </div>

          <div className="tbl-row" style={{ gridTemplateColumns: "1.6fr 1fr 1.4fr 1fr" }}>
            <div>
              <div className="tbl-lbl">Gros œuvre / maçonnerie</div>
              <div className="tbl-sub">Béton, parpaings, mortier</div>
            </div>
            <div className="iu">
              <input type="number" value={mGo} min={0} step={50} onChange={(e) => setMGo(num(e.target.value))} />
              <span className="u">€</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <input type="range" min={0} max={20} value={pGo} step={1} style={{ flex: 1, height: 4, accentColor: "var(--green-dark)" }} onChange={(e) => setPGo(num(e.target.value))} />
              <span style={{ fontSize: 16, fontWeight: 700, minWidth: 38, textAlign: "right" }}>{pGo}%</span>
            </div>
            <div className="tbl-r">{f(t_go, 0)}</div>
          </div>

          <div className="tbl-row" style={{ gridTemplateColumns: "1.6fr 1fr 1.4fr 1fr" }}>
            <div>
              <div className="tbl-lbl">Revêtements / carrelage</div>
              <div className="tbl-sub">Carrelage, parquet, faïence</div>
            </div>
            <div className="iu">
              <input type="number" value={mRev} min={0} step={50} onChange={(e) => setMRev(num(e.target.value))} />
              <span className="u">€</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <input type="range" min={0} max={25} value={pRev} step={1} style={{ flex: 1, height: 4, accentColor: "var(--green-dark)" }} onChange={(e) => setPRev(num(e.target.value))} />
              <span style={{ fontSize: 16, fontWeight: 700, minWidth: 38, textAlign: "right" }}>{pRev}%</span>
            </div>
            <div className="tbl-r">{f(t_rev, 0)}</div>
          </div>

          <div className="tbl-row" style={{ gridTemplateColumns: "1.6fr 1fr 1.4fr 1fr" }}>
            <div>
              <div className="tbl-lbl">Peinture / plâtrerie</div>
              <div className="tbl-sub">BA13, enduit, peinture</div>
            </div>
            <div className="iu">
              <input type="number" value={mPei} min={0} step={50} onChange={(e) => setMPei(num(e.target.value))} />
              <span className="u">€</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <input type="range" min={0} max={20} value={pPei} step={1} style={{ flex: 1, height: 4, accentColor: "var(--green-dark)" }} onChange={(e) => setPPei(num(e.target.value))} />
              <span style={{ fontSize: 16, fontWeight: 700, minWidth: 38, textAlign: "right" }}>{pPei}%</span>
            </div>
            <div className="tbl-r">{f(t_pei, 0)}</div>
          </div>

          <div className="tbl-foot" style={{ gridTemplateColumns: "1.6fr 1fr 1.4fr 1fr" }}>
            <span style={{ fontSize: 14, fontWeight: 700 }}>Total matériaux</span>
            <span style={{ fontSize: 14, textAlign: "right", color: "var(--gray3)" }}>{f(mat_brut, 0)}</span>
            <span></span>
            <span style={{ fontSize: 17, fontWeight: 700, textAlign: "right", color: "var(--green)" }}>{f(mat, 0)}</span>
          </div>
        </div>

        {/* 2 MAIN D'ŒUVRE */}
        <p className="stitle">2 — Main d&apos;œuvre</p>
        <div className="card">
          <div className="g3" style={{ marginBottom: "1rem" }}>
            <div className="field">
              <label>Durée estimée</label>
              <div className="iu">
                <input type="number" value={jours} min={0.5} step={0.5} onChange={(e) => setJours(num(e.target.value))} />
                <span className="u">j</span>
              </div>
            </div>
            <div className="field">
              <label>Nb ouvriers</label>
              <div className="iu">
                <input type="number" value={ouvRaw} min={1} max={20} onChange={(e) => setOuvRaw(num(e.target.value))} />
                <span className="u">pers.</span>
              </div>
            </div>
            <div className="field">
              <label>Taux horaire chargé</label>
              <div className="iu">
                <input type="number" value={taux} min={15} max={120} step={0.5} onChange={(e) => setTaux(num(e.target.value))} />
                <span className="u">€/h</span>
              </div>
              <div className="hint">Salaire brut + charges (~79%)</div>
            </div>
          </div>

          <div className="field">
            <label>
              Productivité réelle <span style={{ fontWeight: 400, color: "var(--gray3)" }}>— h produites sur 8h présentes</span>
            </label>
            <div className="sl-row">
              <input type="range" min={55} max={100} value={prod} step={5} onChange={(e) => setProd(num(e.target.value))} />
              <span className="slv">{prod}%</span>
            </div>
            <div className="hint">Standard : 80% · Chantier simple : 85–90% · Contraintes fortes : 65–70%</div>
          </div>

          <div className="field" style={{ marginTop: ".75rem" }}>
            <label>
              Majoration MO <span style={{ fontWeight: 400, color: "var(--gray3)" }}>— conditions difficiles</span>
            </label>
            <div className="sl-row">
              <input type="range" min={0} max={50} value={majo} step={5} onChange={(e) => setMajo(num(e.target.value))} />
              <span className="slv">{majo}%</span>
            </div>
            <div className="hint">+10% local occupé · +30% rampant toiture · 0% standard</div>
          </div>

          <div className="field" style={{ marginTop: ".75rem" }}>
            <label>
              Buffer dépassement de délai <span style={{ fontWeight: 400, color: "var(--gray3)" }}>— aléas réalistes, MO + frais journaliers uniquement</span>
            </label>
            <div className="sl-row">
              <input type="range" min={0} max={50} value={buf} step={5} onChange={(e) => setBuf(num(e.target.value))} />
              <span className="slv o">{buf}%</span>
            </div>
            <div className="hint">Rénovation ancienne : 15–25% · Neuf maîtrisé : 5–10% · Matériaux non affectés</div>
          </div>
        </div>

        {/* 3 FRAIS */}
        <p className="stitle">3 — Frais divers</p>
        <div className="card">
          <div className="tbl-hd" style={{ gridTemplateColumns: "2fr 1fr 1fr 1fr" }}>
            <span style={{ fontSize: 11, color: "var(--gray3)", fontWeight: 600, textTransform: "uppercase", letterSpacing: ".05em" }}>Poste</span>
            <span style={{ fontSize: 11, color: "var(--gray3)", fontWeight: 600, textTransform: "uppercase", letterSpacing: ".05em", textAlign: "right" }}>€/jour</span>
            <span style={{ fontSize: 11, color: "var(--gray3)", fontWeight: 600, textTransform: "uppercase", letterSpacing: ".05em", textAlign: "right" }}>Jours réels</span>
            <span style={{ fontSize: 11, color: "var(--gray3)", fontWeight: 600, textTransform: "uppercase", letterSpacing: ".05em", textAlign: "right" }}>Total</span>
          </div>
          <div className="tbl-row" style={{ gridTemplateColumns: "2fr 1fr 1fr 1fr" }}>
            <div>
              <div className="tbl-lbl">Déplacements</div>
              <div className="tbl-sub">Carburant + péages</div>
            </div>
            <div className="iu">
              <input type="number" value={fDep} min={0} step={1} onChange={(e) => setFDep(num(e.target.value))} />
              <span className="u">€</span>
            </div>
            <div style={{ textAlign: "right", paddingRight: 12, fontSize: 14, color: "var(--gray4)" }}>{jr.toFixed(1)} j</div>
            <div className="tbl-r">{f(td, 0)}</div>
          </div>
          <div className="tbl-row" style={{ gridTemplateColumns: "2fr 1fr 1fr 1fr" }}>
            <div>
              <div className="tbl-lbl">Consommables</div>
              <div className="tbl-sub">Disques, forets, bâches…</div>
            </div>
            <div className="iu">
              <input type="number" value={fCon} min={0} step={1} onChange={(e) => setFCon(num(e.target.value))} />
              <span className="u">€</span>
            </div>
            <div style={{ textAlign: "right", paddingRight: 12, fontSize: 14, color: "var(--gray4)" }}>{jr.toFixed(1)} j</div>
            <div className="tbl-r">{f(tc, 0)}</div>
          </div>
          <div className="tbl-row" style={{ gridTemplateColumns: "2fr 1fr 1fr 1fr" }}>
            <div>
              <div className="tbl-lbl">Location matériel</div>
              <div className="tbl-sub">Échafaudage, bétonnière…</div>
            </div>
            <div className="iu">
              <input type="number" value={fLoc} min={0} step={5} onChange={(e) => setFLoc(num(e.target.value))} />
              <span className="u">€</span>
            </div>
            <div style={{ textAlign: "right", paddingRight: 12, fontSize: 14, color: "var(--gray4)" }}>{jr.toFixed(1)} j</div>
            <div className="tbl-r">{f(tl, 0)}</div>
          </div>
          <div className="tbl-row" style={{ gridTemplateColumns: "2fr 1fr 1fr 1fr" }}>
            <div>
              <div className="tbl-lbl">Benne / évacuation</div>
              <div className="tbl-sub">Forfait unique</div>
            </div>
            <div className="iu">
              <input type="number" value={fBen} min={0} step={10} onChange={(e) => setFBen(num(e.target.value))} />
              <span className="u">€</span>
            </div>
            <div style={{ textAlign: "right", paddingRight: 12, fontSize: 14, color: "var(--gray3)" }}>forfait</div>
            <div className="tbl-r">{f(fb, 0)}</div>
          </div>
          <div className="tbl-row" style={{ gridTemplateColumns: "2fr 1fr 1fr 1fr" }}>
            <div>
              <div className="tbl-lbl">Sous-traitance / divers</div>
              <div className="tbl-sub">Intervention ponctuelle</div>
            </div>
            <div className="iu">
              <input type="number" value={fSt} min={0} step={50} onChange={(e) => setFSt(num(e.target.value))} />
              <span className="u">€</span>
            </div>
            <div style={{ textAlign: "right", paddingRight: 12, fontSize: 14, color: "var(--gray3)" }}>forfait</div>
            <div className="tbl-r">{f(fs, 0)}</div>
          </div>
          <div className="tbl-foot" style={{ gridTemplateColumns: "2fr 1fr 1fr 1fr" }}>
            <span style={{ fontSize: 14, fontWeight: 700 }}>Total frais divers</span>
            <span></span>
            <span></span>
            <span style={{ fontSize: 17, fontWeight: 700, textAlign: "right", color: "var(--green)" }}>{f(frais, 0)}</span>
          </div>
        </div>

        {/* 4 PARAMÈTRES */}
        <p className="stitle">4 — Paramètres entreprise</p>
        <div className="card">
          <div className="g2">
            <div className="field">
              <label>Coefficient frais généraux</label>
              <input type="number" value={cfgRaw} min={1} max={2} step={0.01} onChange={(e) => { setCfgRaw(num(e.target.value)); setCfgFromFg(false); }} />
              <div className="hint">1,305 standard · 1,25 micro-entreprise</div>
              <div style={{ marginTop: 10 }}>
                <button className="acc-btn" onClick={togFG}>
                  <span>Calculer mon coefficient ▸</span>
                  <span style={{ fontWeight: 700, color: "var(--green)" }}>{fgOpen && !fgInvalid ? "→ " + fgCoeff.toFixed(3) : ""}</span>
                </button>
                <div className={"acc-body" + (fgOpen ? " open" : "")}>
                  <div className="g2" style={{ marginBottom: 8 }}>
                    <div className="field" style={{ marginBottom: 0 }}>
                      <label>Charges fixes annuelles</label>
                      <div className="iu">
                        <input type="number" value={fgCh} min={0} step={500} onChange={(e) => editFgCh(num(e.target.value))} />
                        <span className="u">€</span>
                      </div>
                      <div className="hint">Assurances, véhicule, comptable…</div>
                    </div>
                    <div className="field" style={{ marginBottom: 0 }}>
                      <label>CA annuel estimé</label>
                      <div className="iu">
                        <input type="number" value={fgCa} min={1} step={1000} onChange={(e) => editFgCa(num(e.target.value))} />
                        <span className="u">€</span>
                      </div>
                    </div>
                  </div>
                  {fgInvalid && (
                    <div
                      style={{
                        marginBottom: 8,
                        padding: "8px 10px",
                        background: "var(--red-bg)",
                        color: "var(--red)",
                        borderRadius: "var(--radius-sm)",
                        fontSize: 13,
                        lineHeight: 1.4,
                      }}
                    >
                      ⚠ Vos charges fixes dépassent ou égalent votre CA annuel
                      estimé — le coefficient ne peut pas être calculé de façon
                      fiable. Vérifiez vos hypothèses.
                    </div>
                  )}
                  <div className="tpl-btns">
                    <button className="tpl-btn" onClick={() => setFG(12000, 55000)}>Artisan solo</button>
                    <button className="tpl-btn" onClick={() => setFG(25000, 110000)}>TPE 2–3 pers.</button>
                    <button className="tpl-btn" onClick={() => setFG(55000, 250000)}>PME 5–10 pers.</button>
                  </div>
                </div>
              </div>
            </div>
            <div>
              <div className="field">
                <label>Marge objectif</label>
                <div className="sl-row">
                  <input type="range" min={5} max={50} value={marge} step={1} onChange={(e) => setMarge(num(e.target.value))} />
                  <span className="slv g">{marge}%</span>
                </div>
              </div>
              <div className="field" style={{ marginTop: ".5rem" }}>
                <label>TVA applicable</label>
                <select value={tva} onChange={(e) => setTva(e.target.value)}>
                  <option value="5.5">5,5% — Rénovation énergétique / logement &gt;2 ans</option>
                  <option value="10">10% — Travaux logement &gt;2 ans (standard)</option>
                  <option value="20">20% — Taux plein / neuf / pro</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* RÉSULTATS */}
        <p className="stitle">Résultats</p>

        <div className="mode-toggle">
          <button className={"mode-btn" + (mode === "c" ? " active" : "")} onClick={() => setMode("c")}>
            Calculer mon prix de vente
          </button>
          <button className={"mode-btn" + (mode === "i" ? " active" : "")} onClick={() => setMode("i")}>
            Analyser un prix proposé par le client
          </button>
        </div>

        {mode === "i" && (
          <div className="pvc">
            <div className="g2" style={{ alignItems: "center" }}>
              <div>
                <label style={{ color: "#1a4a8a", fontWeight: 600 }}>Prix proposé par le client HT</label>
                <div className="iu">
                  <input type="number" value={pvC} min={0} step={100} onChange={(e) => setPvC(num(e.target.value))} />
                  <span className="u">€</span>
                </div>
                <div className="hint">L&apos;outil calcule la marge que ce prix génère sur vos coûts réels</div>
              </div>
              <div style={{ padding: "12px 16px", borderRadius: 0, fontSize: 14, fontWeight: 500, background: pvcBg, color: pvcColor }}>{pvcText}</div>
            </div>
          </div>
        )}

        {fgInvalid && (
          <div
            style={{
              marginBottom: 12,
              padding: "12px 16px",
              background: "var(--red-bg)",
              color: "var(--red)",
              borderRadius: "var(--radius-sm)",
              fontSize: 14,
              fontWeight: 500,
              lineHeight: 1.4,
            }}
          >
            ⚠ Vos charges fixes dépassent ou égalent votre CA annuel estimé. Le
            coefficient de frais généraux ne peut pas être calculé — le prix de
            revient et le prix de vente conseillé sont indisponibles tant que
            ces hypothèses ne sont pas corrigées.
          </div>
        )}
        <div className="mg4">
          <div className="metric">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
              <div className="ml">Déboursé sec</div>
              <span style={{ fontSize: 12, fontWeight: 600, color: "var(--gray3)", background: "var(--gray-bg)", borderRadius: 0, padding: "2px 8px" }}>{pds.toFixed(1)}%</span>
            </div>
            <div className="mv">{f(ds, 0)}</div>
            <div className="ms">Coût direct réel</div>
          </div>
          <div className="metric">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
              <div className="ml">Prix de revient</div>
              <span style={{ fontSize: 12, fontWeight: 600, color: "var(--gray3)", background: "var(--gray-bg)", borderRadius: 0, padding: "2px 8px" }}>{fgInvalid ? "—" : ppr.toFixed(1) + "%"}</span>
            </div>
            <div className="mv">{fgInvalid ? "—" : f(pr, 0)}</div>
            <div className="ms">Après frais généraux</div>
          </div>
          <div className="metric">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
              <div className="ml">{lblPv}</div>
              <span style={{ fontSize: 12, fontWeight: 600, color: "var(--green)", background: "var(--green-light)", borderRadius: 0, padding: "2px 8px" }}>100 %</span>
            </div>
            <div className="mv" style={{ color: "var(--green)" }}>{fgInvalid && mode === "c" ? "—" : f(pv, 0)}</div>
            <div className="ms">{subPv}</div>
          </div>
          <div className="metric">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
              <div className="ml">Marge brute</div>
              <span style={{ fontSize: 12, fontWeight: 600, borderRadius: 0, padding: "2px 8px", background: mbBg, color: mbColor }}>{mr.toFixed(1)}%</span>
            </div>
            <div className="mv">{f(mb, 0)}</div>
            <div className="ms">sur prix de vente</div>
          </div>
        </div>

        <div className="rs">
          <div className="rc">
            <div className="rc-t">Ce que tu factures</div>
            <div className="rl hi">
              <span className="rl-l">Prix de vente HT</span>
              <span className="rl-v">{f(pv, 0)}</span>
            </div>
            <div className="rl">
              <span className="rl-l">TVA ({tva_t}%)</span>
              <span className="rl-v">{f(tvaVal, 0)}</span>
            </div>
            <div className="rl hi">
              <span className="rl-l">Prix de vente TTC</span>
              <span className="rl-v">{f(ttc, 0)}</span>
            </div>
          </div>
          <div className="rc">
            <div className="rc-t">Ce que tu gardes</div>
            <div className="rl">
              <span className="rl-l">Marge brute chantier</span>
              <span className="rl-v">{f(mb, 0) + " (" + p(mr) + ")"}</span>
            </div>
            <div className="rl">
              <span className="rl-l">IS estimé (15% taux PME)</span>
              <span className="rl-v" style={{ color: "var(--red)" }}>{"− " + f(is, 0)}</span>
            </div>
            <div className="rl net">
              <span className="rl-l" style={{ fontWeight: 600 }}>Résultat net estimé</span>
              <span className="rl-v">{f(net, 0)}</span>
            </div>
            <div style={{ fontSize: 11, color: "var(--gray3)", marginTop: 8, lineHeight: 1.5 }}>
              ⚠ Marge brute ≠ bénéfice net. L&apos;IS s&apos;applique au résultat fiscal de l&apos;entreprise, pas à ce seul chantier.
            </div>
          </div>
        </div>

        <div className="cc">
          <div className="cr">
            <div>
              <div className="cl"><span className="step">1</span>Matériaux (pertes par catégorie)</div>
              <div className="cf">{cf_mat}</div>
            </div>
            <div className="cv">{f(mat, 0)}</div>
          </div>
          <div className="cr">
            <div>
              <div className="cl"><span className="step">2</span>Main d&apos;œuvre réelle</div>
              <div className="cf">{cf_mo}</div>
            </div>
            <div className="cv">{f(mo, 0)}</div>
          </div>
          <div className="cr">
            <div>
              <div className="cl"><span className="step">3</span>Frais divers (buffer inclus)</div>
              <div className="cf">{fd_det}</div>
            </div>
            <div className="cv">{f(frais, 0)}</div>
          </div>
          <div className="cr sub">
            <div>
              <div className="cl"><span className="step" style={{ fontWeight: 700 }}>=</span>Déboursé sec</div>
              <div className="cf">Mat. + MO + Frais</div>
            </div>
            <div className="cv">{f(ds, 0)}</div>
          </div>
          <div className="cr">
            <div>
              <div className="cl"><span className="step">4</span>Frais généraux</div>
              <div className="cf">{cf_fg}</div>
            </div>
            <div className="cv">{"+ " + f(fg_m, 0)}</div>
          </div>
          <div className="cr sub">
            <div>
              <div className="cl"><span className="step" style={{ fontWeight: 700 }}>=</span>Prix de revient</div>
              <div className="cf">DS × coeff. FG</div>
            </div>
            <div className="cv">{f(pr, 0)}</div>
          </div>
          <div className="cr">
            <div>
              <div className="cl"><span className="step">5</span>Marge & aléas</div>
              <div className="cf">{cf_mb}</div>
            </div>
            <div className="cv">{"+ " + f(mb, 0)}</div>
          </div>
          <div className="cr tot">
            <div>
              <div className="cl"><span className="step">✓</span><strong>Prix de vente HT</strong></div>
              <div className="cf">{cf_pv}</div>
            </div>
            <div className="cv">{f(pv, 0)}</div>
          </div>
        </div>

        <div className="mbw">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: "var(--gray4)" }}>Marge brute sur prix de vente</span>
            <span style={{ fontSize: 26, fontWeight: 700, letterSpacing: "-0.02em", color: bc }}>{p(mr)}</span>
          </div>
          <div className="bar-track">
            <div className="bar-fill" style={{ width: bw + "%", background: bc }}></div>
          </div>
          <div className="bar-lbl">
            <span>0%</span><span>10%</span><span>20%</span><span>30%</span><span>40%</span><span>50%</span>
          </div>
          <div className={verdictClass}>{verdictText}</div>
          <div className="fourchette">
            <strong>Fourchette réaliste</strong> (aléas non modélisés : −12 à −22 pts) : <strong>{fmin.toFixed(0)}% → {fmax.toFixed(0)}%</strong> de marge effective probable.
          </div>
        </div>

        <div className="card">
          <div className="rc-t" style={{ marginBottom: ".75rem" }}>Analyse complémentaire</div>
          <div className="kg">
            <div className="kpi">
              <div className="kpi-l">Ratio MO / Matériaux</div>
              <div className="kpi-v" style={{ color: ratioColor }}>{ratio.toFixed(2)}</div>
              <div className="kpi-s">Équilibré entre 0,5 et 1,5</div>
            </div>
            <div className="kpi">
              <div className="kpi-l">Coût journalier réel</div>
              <div className="kpi-v">{jr > 0 ? f(ds / jr, 0) + "/j" : "—"}</div>
              <div className="kpi-s">DS ÷ jours réels (buffer inclus)</div>
            </div>
            <div className="kpi">
              <div className="kpi-l">CA journalier facturé</div>
              <div className="kpi-v">{jr > 0 ? f(pv / jr, 0) + "/j" : "—"}</div>
              <div className="kpi-s">PV HT ÷ jours réels</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

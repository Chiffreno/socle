import LegacyTool from "@/components/LegacyTool";
import { loadLegacy } from "@/lib/legacy/extract";

const GLOBALS = [
  "addCustomLine",
  "cancelEdit",
  "commitEdit",
  "exportCSV",
  "exportPDF",
  "exportShoppingList",
  "liveCustomTotal",
  "removeCustomLine",
  "resetProject",
  "rstAllPrice",
  "rstAllPrices",
  "rstPrice",
  "setCustomLine",
  "setLot",
  "setMarge",
  "setOpt",
  "setOptN",
  "setPx",
  "setQuality",
  "setSurf",
  "setGS",
  "setTVA",
  "startEdit",
  "toggleLot",
  "toggleTarif",
  "toggleTarifs",
  "toggleCorps",
  "toggleCfg",
  "addLigne",
  "removeLigne",
  "setLigneOpt",
  "setLigneM2",
  "render",
  "state",
];

// ── Re-skin « langage visuel devis » ──────────────────────────────────────
// La page vit désormais dans le route group (editor) : elle hérite du rail
// SOCLE + bouton circulaire vert (la « flèche verte ») via EditorShell, comme
// l'éditeur de devis. On aligne ensuite l'outil legacy sur le vocabulaire .dee-*
// (vert SOCLE généreux, radius mesuré, ombres douces, chiffres Space Grotesk).
//
// 1) OVERRIDES : remappe les tokens internes de l'outil vers la palette devis.
//    Injectés sur :scope APRÈS le :root legacy → la cascade les fait gagner.
//    (loadLegacy strippe radius/shadow du CSS d'origine ; ils sont réintroduits
//     dans EXTRA_CSS, qui n'est pas strippé.)
const OVERRIDES = [
  "--sans:var(--ff)", // Inter non chargée → police SOCLE (Figtree)
  "--mono:var(--num)", // chiffres en Space Grotesk tabulaire (comme le devis)
  "--accent:var(--green)",
  "--accent2:var(--green-dark)",
  "--green:var(--green)",
  "--bg2:#fafbfc", // fond léger (dee-fill-2)
  "--bg3:#f5f6f7", // survol / zones (dee-fill)
  "--bg4:#eef1f3",
  "--border:#e0e0e0", // bordures (dee-line, plus contrasté que le gris pâle)
  "--border2:#d2d2d2", // bordures marquées (dee-line-2)
  "--text2:#4a4a4a", // secondaire dense (dee-ink-2)
  "--text3:#8a8a8a", // tertiaire lisible (dee-ink-3)
].join(";");

// 2) EXTRA_CSS : layout plein écran (sous le rail, pas de topbar) + re-skin
//    des surfaces visibles pour coller à l'éditeur de devis.
const EXTRA_CSS = `
  /* Plein écran sous le rail éditeur (aucune topbar globale ici). */
  :scope { display: block; height: 100vh; }
  #app { height: 100%; }

  /* Tokens visuels locaux (repris de devis-editor-engine.css). */
  :scope {
    --r:        8px;
    --r-sm:     6px;
    --shadow-sm:   0 1px 2px rgba(16,24,40,.05), 0 1px 1px rgba(16,24,40,.04);
    --shadow-card: 0 1px 3px rgba(16,24,40,.06), 0 6px 16px rgba(16,24,40,.06);
  }

  /* ── Colonnes : surfaces blanches, séparateurs doux ── */
  #sidebar { background: var(--bg); border-right: 1px solid var(--border); }
  #summary { background: var(--bg); border-left: 1px solid var(--border); }
  #main    { background: var(--bg2); }
  .lot-header, .lot-options, .lot-footer { background: var(--bg2); }

  /* ── Nav des lots : cartes arrondies, état courant vert (cf. .dee-lot-row) ── */
  .nav-scroll { padding: 6px 7px; }
  .nav-item {
    border-bottom: none;
    border: 1px solid transparent;
    border-radius: var(--r-sm);
    margin-bottom: 2px;
    transition: background .15s ease, border-color .15s ease, box-shadow .15s ease;
  }
  .nav-item:hover { background: var(--bg3); }
  .nav-item.active {
    background: var(--green-light);
    border-color: var(--green-b);
    box-shadow: var(--shadow-sm);
  }
  .nav-item.active::before { display: none; }
  .nav-item.active .nav-label { color: var(--green-dark); font-weight: 600; }
  .nav-item.active .nav-num, .nav-item.active .nav-amount { color: var(--green); }

  /* ── Segments (TVA / qualité / options) : actif vert ── */
  .tva-seg, .quality-seg, .mini-seg { border-radius: var(--r-sm); overflow: hidden; }
  .tva-seg button.on, .mini-seg button.on {
    background: var(--green-light); color: var(--green-dark); font-weight: 500;
  }
  .quality-seg button.active { background: var(--green); color: #fff; }

  /* ── Cartes qualité / matériaux / variantes / équipements : actif vert ── */
  .qcard, .matc, .eq-var, .appcard, .prot-row { border-radius: var(--r-sm); }
  .eq-row, .zone-card-n { border-radius: var(--r); }
  .zone-card-n { box-shadow: var(--shadow-sm); }
  .zone-card-n.zon { border-color: var(--green-b); }
  .qcard.active, .matc.on, .eq-var.on, .appcard.on {
    border-color: var(--green);
    background: var(--green-light);
    color: var(--green-dark);
  }
  .qcard.active .qc-lbl, .appcard.on .ac-name { color: var(--green-dark); }
  .matc:hover, .eq-var:hover, .qcard:hover { border-color: var(--green-b); }

  /* ── Boutons ── */
  .hdr-btn, .reset-btn, .price-edit button { border-radius: var(--r-sm); }
  .hdr-btn:hover { border-color: var(--green-b); color: var(--green-dark); }
  .hdr-btn.active-lot { border-color: var(--green); color: var(--green); }
  .sum-action {
    border-radius: var(--r-sm);
    box-shadow: var(--shadow-sm);
    transition: background .12s, border-color .12s, color .12s, box-shadow .12s;
  }
  .sum-action:hover {
    border-color: var(--green-b); background: var(--green-light); color: var(--green-dark);
  }
  .sum-action.accent {
    background: var(--green); border-color: var(--green); color: #fff;
    box-shadow: var(--shadow-sm);
  }
  .sum-action.accent:hover { background: var(--green-dark); border-color: var(--green-dark); }

  /* ── Inputs : anneau de focus vert (cf. .dee-input) ── */
  input[type=number], input[type=text], select, .price-edit input {
    border-radius: var(--r-sm);
    transition: border-color .12s, box-shadow .12s;
  }
  :scope input[type=number]:focus,
  :scope input[type=text]:focus,
  :scope select:focus,
  :scope .price-edit input:focus {
    border-color: var(--green);
    box-shadow: 0 0 0 3px var(--green-light);
  }

  /* ── Switchs (lot / zone) : piste en pilule, actif vert (knob garde 50%) ── */
  .lot-sw, .zsw { border-radius: 999px; }

  /* ── Prix éditable inline ── */
  .price-display { border-radius: var(--r-sm); }
  .price-display:hover { border-color: var(--green-b); background: var(--green-light); }
  .price-display.modified { color: var(--green); }
  .reset-btn:hover { color: var(--green); }
  .price-edit input { border-color: var(--green); }
  .price-edit button.ok { background: var(--green); }

  /* ── Tableau matériaux ── */
  table.ptable thead th { background: var(--bg2); }
  table.ptable tbody tr:hover { background: var(--bg3); }
  table.ptable td.total.hl { color: var(--green); }

  /* ── Récapitulatif (colonne droite) ── */
  .sg-m2-cell { border-radius: var(--r-sm); background: var(--bg2); }
  .sg-amount, .ft-amount { color: var(--green); }
  .bar-fill { border-radius: 999px; }
  .bar-bg { border-radius: 999px; }

  /* ── Toast + tooltip : façon .dee-toast ── */
  #toast { border-radius: var(--r-sm); box-shadow: var(--shadow-card); }
  .tip-bubble { border-radius: var(--r-sm); box-shadow: var(--shadow-card); }

  /* ════════════════════════════════════════════════════════════════════
     CONFIGURATEUR EN BOX — « langage devis » (.dee-cfg-*)
     Pilote : lot Cloisons. Sous-ensemble repris à l'identique de
     devis-editor-engine.css (non chargé hors route éditeur → embarqué ici).
     Box repliable à en-tête vert + pills/champs ; cartes-zones conservées
     mais re-stylées au devis (sélecteurs scopés .dee-cfg-box → n'affecte
     que les lots migrés).
     ════════════════════════════════════════════════════════════════════ */
  :scope {
    --dee-line:   #e0e0e0;
    --dee-line-2: #d2d2d2;
    --dee-ink-3:  #8a8a8a;
    --dee-ink-2:  #4a4a4a;
    --dee-fill-2: #fafbfc;
    --dee-cfg-bg: #eef8f2;
    /* Harmonisation : largeur UNIQUE des champs num (résorbe 44/48/50/52/58/60px). */
    --mxc-fieldw: 84px;
    /* Échelle de gaps du gabarit devis. */
    --mxc-gap-pill:   6px;   /* entre pills */
    --mxc-gap-col:    12px;  /* lignes de grille / champs empilés */
    --mxc-gap-body:   14px;  /* corps de box */
    --mxc-grid-colgap:20px;  /* colonnes de la grille 2 col */
  }

  /* Zone configurateur : bandeau teinté vert dès qu'elle contient une box. */
  .lot-options:has(.dee-cfg-box) {
    display: block;
    background: var(--dee-cfg-bg);
    border-bottom: 2px solid var(--green-b);
    padding: 12px 16px 14px;
    max-height: 48vh;
    overflow-y: auto;
  }

  /* Box (en-tête vert + corps) — cf. .dee-cfg-box. */
  .dee-cfg-box {
    background: var(--bg);
    border: 1px solid var(--dee-line);
    border-radius: var(--r);
    box-shadow: var(--shadow-card);
    overflow: hidden;
  }
  .dee-cfg-box-head {
    display: flex; align-items: center; gap: 9px;
    width: 100%; padding: 11px 16px;
    background: var(--green); border: none; cursor: pointer;
    text-align: left; transition: background .12s;
  }
  .dee-cfg-box-head:hover { background: var(--green-dark); }
  .dee-cfg-box-head-ic { color: #fff; font-size: 16px; }
  .dee-cfg-box-title {
    flex: 1; font-family: var(--ff); font-size: 12px; font-weight: 600;
    text-transform: uppercase; letter-spacing: .08em; color: #fff;
  }
  .dee-cfg-box-caret { font-size: 16px; color: #fff; }
  .dee-cfg-box-body { padding: 14px 16px; display: flex; flex-direction: column; gap: var(--mxc-gap-body); }

  /* Champs + pills — cf. .dee-cfg-field / .dee-cfg-pills / .dee-cfg-pill. */
  .dee-cfg-field { display: flex; flex-direction: column; gap: 6px; }
  .dee-cfg-flabel {
    font-family: var(--ff); font-size: 10px; font-weight: 600;
    text-transform: uppercase; letter-spacing: .08em; color: var(--dee-ink-3);
  }
  .dee-cfg-hint {
    font-style: normal; font-family: var(--num); text-transform: none;
    letter-spacing: 0; color: var(--green); margin-left: 6px;
  }
  .dee-cfg-pills { display: inline-flex; flex-wrap: wrap; gap: var(--mxc-gap-pill); }
  .dee-cfg-pill {
    padding: 6px 12px; background: var(--bg);
    border: 1px solid var(--dee-line); border-radius: 999px;
    font-family: var(--ff); font-size: 12px; font-weight: 500;
    color: var(--dee-ink-2); cursor: pointer; line-height: 1.25; text-align: left;
    transition: border-color .12s, background .12s, color .12s;
  }
  .dee-cfg-pill:hover { border-color: var(--green-b); color: var(--text); }
  .dee-cfg-pill.is-active {
    border-color: var(--green); background: var(--green-light);
    color: var(--green-dark); font-weight: 600;
  }
  .dee-cfg-pill .ms { display: block; font-size: 9px; opacity: .7; margin-top: 1px; font-weight: 400; }

  .dee-cfg-surf { display: inline-flex; align-items: center; gap: 6px; }
  .dee-cfg-surf input {
    width: var(--mxc-fieldw); padding: 7px 9px; background: var(--bg);
    border: 1px solid var(--dee-line); border-radius: var(--r-sm);
    font-family: var(--num); font-size: 13px; font-weight: 500; color: var(--text);
  }
  .dee-cfg-unit { font-family: var(--num); font-size: 12px; color: var(--dee-ink-3); }

  /* Checkbox custom — cf. .dee-cfg-check. */
  .dee-cfg-check {
    display: inline-flex; align-items: center; gap: 8px;
    font-family: var(--ff); font-size: 12px; color: var(--dee-ink-2); cursor: pointer;
  }
  .dee-cfg-check input { position: absolute; opacity: 0; pointer-events: none; }
  .dee-cfg-check-box {
    width: 16px; height: 16px; border: 1.5px solid var(--dee-ink-3);
    border-radius: 4px; background: var(--bg); flex-shrink: 0;
    display: inline-flex; align-items: center; justify-content: center;
    transition: border-color .12s, background .12s;
  }
  .dee-cfg-check:hover .dee-cfg-check-box { border-color: var(--green); }
  .dee-cfg-check input:checked + .dee-cfg-check-box { background: var(--green); border-color: var(--green); }
  .dee-cfg-check-box::after {
    content: ""; width: 8px; height: 4px;
    border-left: 1.6px solid #fff; border-bottom: 1.6px solid #fff;
    transform: rotate(-45deg) translate(1px, -1px); opacity: 0; transition: opacity .12s;
  }
  .dee-cfg-check input:checked + .dee-cfg-check-box::after { opacity: 1; }

  /* Réglage niveau lot / rangée d'action (chute, primaire, seuils, hint…). */
  .dee-cfg-lot, .dee-cfg-box-action {
    display: flex; align-items: flex-end; flex-wrap: wrap; gap: 16px;
    padding-top: 14px; border-top: 1px solid var(--dee-line);
  }
  .mxc-hint {
    display: inline-flex; align-items: center; gap: 6px; padding-bottom: 4px;
    font-family: var(--ff); font-size: 12px; color: var(--dee-ink-2);
  }
  .mxc-hint .ti { font-size: 15px; color: var(--green); }
  .mxc-hint strong { color: var(--green-dark); font-family: var(--num); }

  /* Cartes-zones DANS la box (widget conservé, re-stylé devis ; scopé box). */
  .mxc-zones { display: flex; flex-direction: column; gap: 8px; }
  .dee-cfg-box .zone-card-n {
    border: 1px solid var(--dee-line); border-radius: var(--r);
    background: var(--bg); box-shadow: var(--shadow-sm); overflow: hidden;
    transition: border-color .12s, box-shadow .12s;
  }
  .dee-cfg-box .zone-card-n.zon { border-color: var(--green-b); }
  .dee-cfg-box .zhead {
    display: flex; align-items: center; gap: 10px;
    padding: 10px 14px; cursor: pointer; user-select: none; transition: background .12s;
  }
  .dee-cfg-box .zhead:hover { background: var(--dee-fill-2); }
  .dee-cfg-box .zone-card-n.zon .zhead { background: var(--green-light); }
  .dee-cfg-box .zsw {
    width: 30px; height: 18px; border-radius: 999px;
    background: var(--gray2); border: 1px solid var(--dee-line-2);
    position: relative; flex-shrink: 0; pointer-events: none;
    transition: background .15s, border-color .15s;
  }
  .dee-cfg-box .zone-card-n.zon .zsw { background: var(--green); border-color: var(--green); }
  .dee-cfg-box .zsw::after {
    content: ""; position: absolute; width: 12px; height: 12px;
    border-radius: 50%; background: #fff; top: 2px; left: 2px;
    transition: transform .15s; box-shadow: 0 1px 2px rgba(0,0,0,.2);
  }
  .dee-cfg-box .zone-card-n.zon .zsw::after { transform: translateX(12px); }
  .dee-cfg-box .zname { flex: 1; font-size: 13px; font-weight: 500; color: var(--dee-ink-2); transition: color .12s; }
  .dee-cfg-box .zone-card-n.zon .zname { color: var(--text); font-weight: 600; }
  .dee-cfg-box .ztype { font-family: var(--ff); font-size: 11px; color: var(--dee-ink-3); }
  .dee-cfg-box .ztype.zm2 { font-family: var(--num); font-weight: 600; color: var(--green); }
  .dee-cfg-box .zbody {
    display: none; flex-direction: column; gap: 12px;
    padding: 12px 14px 14px; border-top: 1px solid var(--dee-line); background: var(--dee-fill-2);
  }
  .dee-cfg-box .zone-card-n.zon .zbody { display: flex; }

  /* Anneau de focus vert sur les inputs de la box (cf. .dee-input). */
  :scope .dee-cfg-box input:focus {
    border-color: var(--green); box-shadow: 0 0 0 3px var(--green-light);
  }

  /* ── Grille 2 colonnes (gabarit devis : 1fr 1fr, gap 12px 20px). ── */
  .dee-cfg-box-grid {
    display: grid; grid-template-columns: 1fr 1fr;
    gap: var(--mxc-gap-col) var(--mxc-grid-colgap);
  }
  .dee-cfg-box-grid .col-full { grid-column: 1 / -1; }

  /* ── Rangée-compteur DANS la box (résorbe .eq-row ; scopé box). ── */
  .dee-cfg-box .eq-row {
    border: 1px solid var(--dee-line); border-radius: var(--r);
    background: var(--bg); box-shadow: var(--shadow-sm); overflow: hidden;
    transition: border-color .12s, box-shadow .12s;
  }
  .dee-cfg-box .eq-row.eq-on { border-color: var(--green-b); }
  .dee-cfg-box .eq-head { display: flex; align-items: center; gap: 10px; padding: 10px 14px; }
  .dee-cfg-box .eq-name { flex: 1; font-family: var(--ff); font-size: 13px; font-weight: 500; color: var(--text); }
  .dee-cfg-box .eq-qty {
    display: inline-flex; align-items: center; flex-shrink: 0; overflow: hidden;
    border: 1px solid var(--dee-line); border-radius: var(--r-sm); background: var(--bg);
  }
  .dee-cfg-box .eq-qty button {
    width: 28px; height: 28px; padding: 0; background: transparent; border: none;
    cursor: pointer; color: var(--dee-ink-2); font-size: 16px; line-height: 1;
    font-family: var(--ff); transition: background .12s, color .12s;
  }
  .dee-cfg-box .eq-qty button:hover { background: var(--green-light); color: var(--green-dark); }
  .dee-cfg-box .eq-qty span {
    font-family: var(--num); font-size: 13px; font-weight: 500;
    min-width: 30px; text-align: center; color: var(--text); line-height: 28px;
  }
  .dee-cfg-box .eq-variants {
    display: flex; flex-wrap: wrap; gap: var(--mxc-gap-pill);
    padding: 10px 14px; border-top: 1px solid var(--dee-line); background: var(--dee-fill-2);
  }

  /* ── Rangée « protection » (demolition) DANS la box ; scopé box. ── */
  .dee-cfg-box .prot-row {
    display: flex; align-items: center; gap: 10px; padding: 10px 14px;
    border: 1px solid var(--dee-line); border-radius: var(--r);
    background: var(--bg); box-shadow: var(--shadow-sm);
  }
  .dee-cfg-box .prot-row .pr-name { flex: 1; font-family: var(--ff); font-size: 13px; color: var(--text); }
  .dee-cfg-box .prot-row .pr-qty { display: inline-flex; align-items: center; gap: 6px; }

  /* ── Grille électroménager (cuisine) DANS la box ; scopé box. ── */
  .dee-cfg-box .appgrid {
    display: grid; grid-template-columns: repeat(auto-fill, minmax(104px, 1fr)); gap: 8px;
  }
  .dee-cfg-box .appcard {
    border: 1px solid var(--dee-line); border-radius: var(--r-sm); background: var(--bg);
    padding: 10px; cursor: pointer; text-align: center;
    transition: border-color .12s, background .12s;
  }
  .dee-cfg-box .appcard:hover { border-color: var(--green-b); }
  .dee-cfg-box .appcard.on { border-color: var(--green); background: var(--green-light); }
  .dee-cfg-box .appcard .ac-icon { font-size: 18px; color: var(--dee-ink-2); }
  .dee-cfg-box .appcard.on .ac-icon { color: var(--green-dark); }
  .dee-cfg-box .appcard .ac-name { font-family: var(--ff); font-size: 11px; color: var(--dee-ink-2); margin-top: 3px; }
  .dee-cfg-box .appcard.on .ac-name { color: var(--green-dark); }

  /* ── Modèle LIGNES : bouton d'ajout + carte de ligne (recyclage .zone-card-n). ── */
  .mxc-addligne {
    display: inline-flex; align-items: center; justify-content: center; gap: 6px;
    width: 100%; padding: 10px 14px;
    background: var(--bg); border: 1px dashed var(--dee-line-2); border-radius: var(--r-sm);
    font-family: var(--ff); font-size: 13px; font-weight: 600; color: var(--dee-ink-2);
    cursor: pointer; transition: border-color .12s, color .12s, background .12s;
  }
  .mxc-addligne:hover { border-color: var(--green-b); color: var(--green-dark); background: var(--green-light); }
  .mxc-addligne .ti { font-size: 16px; }

  /* Carte de ligne : pas de toggle → en-tête non cliquable, corps TOUJOURS visible. */
  .dee-cfg-box .mxc-ligne .zhead { cursor: default; }
  .dee-cfg-box .mxc-ligne .zbody { display: flex; }
  .mxc-ligne-del {
    display: inline-flex; align-items: center; justify-content: center;
    width: 28px; height: 28px; padding: 0; background: transparent; border: none;
    border-radius: var(--r-sm); color: var(--dee-ink-3); cursor: pointer;
    transition: color .12s, background .12s;
  }
  .mxc-ligne-del:hover { color: var(--red); background: var(--red-bg); }
  .mxc-ligne-del .ti { font-size: 17px; }
`;

export default function MateriauxPage() {
  const { html, css, script } = loadLegacy(
    "chiffrage matériaux.html",
    "legacy-chiffrage",
    {
      overrides: OVERRIDES,
      extraCss: EXTRA_CSS,
      replace: [["CHIFFRENO", "SOCLE"]],
    }
  );
  return (
    <LegacyTool
      id="legacy-chiffrage"
      html={html}
      css={css}
      script={script}
      globals={GLOBALS}
    />
  );
}

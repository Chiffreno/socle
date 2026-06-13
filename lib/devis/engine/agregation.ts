// ============================================================
// SOCLE — Moteur Devis — Agrégation lignes client (BRIQUE 1)
//
// Couche AU-DESSUS du moteur : transforme les EngineLigne détaillées
// (plaques, rails, montants, visserie, bandes, enduit…) en LIGNES CLIENT
// synthétiques — une par PRESTATION (approche A2). Ne touche PAS au moteur
// de calcul (calc-items / totals) : on se contente de REGROUPER des
// `lineCA` déjà ventilés (même math que l'aperçu), pas de nouveau calcul.
//
// Trois niveaux du modèle cible :
//   1. Configurateur          → Brique 2 (plus tard)
//   2. Ligne client agrégée   → CE fichier (LigneClient)
//   3. Détail interne         → LigneClient.detailInterne = EngineLigne brutes
//                               (liste de courses / ChiffReno ; jamais montré client)
//
// Périmètre Brique 1 : lot pilote `cloisons` uniquement. Les autres lots
// renvoient `null` → le rendu legacy (ligne à ligne) est conservé.
// ============================================================

import type {
  CarrelageSegment,
  CloisonSegment,
  EngineLigne,
  EngineState,
  FaienceSegment,
  FauxPlafondSegment,
  ItiIso,
  ItiSegment,
  LigneLibre,
  LotId,
  LotLibre,
  ParquetSegment,
  PeintureSegment,
  RemiseMode,
  SegmentBase,
} from "./types";
import {
  lineClientCA,
  lotCAContext,
  round2,
  type DevisTotaux,
  type LotTotaux,
} from "./totals";
import { CATALOGUE_ELEC } from "./catalogue-elec";
import { ITI_FAMILLE_LABEL, itiRText } from "./iti";

/** Ligne synthétique présentée au client (niveau 2). */
export interface LigneClient {
  /** Id du segment source (cloisons) — pour cibler l'édition côté UI. */
  segmentId?: string;
  /** Clé de la ligne hl source (ex. "ba13_std") — identité de la prestation. */
  prestationKey: string;
  /** Libellé commercial ("Fourniture et pose de …"), distinct du technique. */
  libelleCommercial: string;
  /** Libellé technique du moteur (ligne hl) — traçabilité interne. */
  libelleTechnique: string;
  /** Description client générée depuis la config (phrase non technique).
   *  Vide pour les lignes sans config (libre / lot libre). Affichage seul. */
  description: string;
  /** Catégorie affichée en eyebrow de la carte (ex. "BA13 standard").
   *  Portée par la LigneClient → le composant de cartes reste lot-agnostique. */
  categorie?: string;
  /** Quantité commerciale (surface posée) + unité. */
  qty: number;
  unit: string;
  /** Prix de vente client de la prestation = Σ lineCA du groupe (caLot ventilé). */
  prixClient: number;
  /** prixClient / qty — €/u lisible. */
  prixUnitaireClient: number;
  /** Taux TVA de la prestation (repris de la ligne hl — homogène dans la zone). */
  tva: number;
  /** Sous-ligne "dont fourniture" pertinente ? (false pour cloisons — lot non produit-fini.) */
  afficheFourniture: boolean;
  dontFourniture?: number;
  /** C-split (élec) : décomposition CLIENT du total en part fourniture / pose
   *  (matériel indicatif). `fournitureClient + poseClient === prixClient`.
   *  Absents = pas de décomposition affichée. JAMAIS de donnée interne. */
  fournitureClient?: number;
  poseClient?: number;
  /** B2 (lots à points) : si défini, cette ligne est ÉDITABLE inline — prix &
   *  libellé override ponctuel. Valeur = clé d'override (prestationId catalogue).
   *  Absent → ligne non éditable (infra, segments…). */
  overrideKey?: string;
  /** true ssi un override (pu ou lbl) est actif sur cette ligne (indicateur
   *  « modifié » + bouton réinitialiser côté UI). */
  overridden?: boolean;
  /** Niveau 3 — EngineLigne brutes regroupées sous cette prestation. */
  detailInterne: EngineLigne[];
}

// CA client d'une ligne : voir `lineClientCA` / `lotCAContext` (totals.ts) —
// SOURCE UNIQUE de la formule, partagée avec la ventilation TVA.

// ════════════════════════════════════════════════════════════
// AGRÉGATION SEGMENTS — patron générique (cloisons, faux-plafond, …)
// ════════════════════════════════════════════════════════════
//
// Une LigneClient par segment de `o.lignes`, dans l'ordre. Rattachement
// consommables ↔ prestation par `groupId === seg.id` (stable, posé par
// calc-items). Surface posée = seg.m2. `puOverride` (si défini) remplace le PU
// client ventilé (override-aware) ; pour `libre`, le prix ferme du moteur fait
// foi. Chaque lot ne fournit que ses 3 fonctions d'étiquetage (eyebrow / libellé
// commercial / description) — tout le reste est factorisé ici.
interface SegmentLabels {
  /** Eyebrow catégorie de la carte (ex. "BA13 standard"). */
  eyebrow: (seg: SegmentBase) => string;
  /** Libellé commercial généré (segments configurés, hors `libre`). */
  libelle: (seg: SegmentBase) => string;
  /** Description client générée (phrase non technique ; hors `libre`). */
  describe: (seg: SegmentBase) => string;
}

function agregerSegments(
  state: EngineState,
  lt: LotTotaux,
  labels: SegmentLabels
): LigneClient[] {
  const { items } = lt;
  const ctx = lotCAContext(lt);
  const o = state.lots[lt.lotId].o;
  const segments = Array.isArray(o.lignes)
    ? (o.lignes as SegmentBase[])
    : [];

  // 1er passage : prix ventilé NATUREL par segment (round2 par segment).
  const rows = segments
    .map((seg) => {
      const groupe = items.filter((l) => l.groupId === seg.id);
      if (groupe.length === 0) return null;
      const hl = groupe.find((l) => l.hl) ?? groupe[0];
      const isLibre = seg.type === "libre";
      const ventile = round2(
        groupe.reduce((acc, l) => acc + lineClientCA(l, ctx), 0)
      );
      const override =
        !isLibre && typeof seg.puOverride === "number" && seg.puOverride >= 0;
      return { seg, groupe, hl, isLibre, ventile, override };
    })
    .filter((r) => r !== null);

  // Arrondir CHAQUE segment puis sommer peut dériver de quelques centimes vs
  // round2(caLot) (l'invariant « Σ lignes == HT lot »). Le reliquat est absorbé
  // par le PREMIER segment ventilé non-libre (même principe que l'infra élec).
  // Porteur STABLE, indépendant des overrides : si le porteur est overridé son
  // ventilé est remplacé à l'affichage (le reliquat s'éteint) et les totaux
  // client sont recomposés depuis les unités (chemin hasOverride) — les autres
  // segments ne bougent JAMAIS d'un centime quand on pose/retire un override.
  const sommeNaturals = round2(rows.reduce((a, r) => a + r.ventile, 0));
  const reliquat = round2(lt.caLot - sommeNaturals);
  if (reliquat !== 0) {
    const porteur = rows.find((r) => !r.isLibre);
    if (porteur) porteur.ventile = round2(porteur.ventile + reliquat);
  }

  const out: LigneClient[] = [];
  for (const { seg, groupe, hl, isLibre, ventile, override } of rows) {
    const qty = Number(seg.m2) || hl.qty;
    // Override-aware : un PU surchargé remplace le prix ventilé (sauf `libre`,
    // dont le prix ferme est déjà porté par la ligne moteur).
    const prixClient = override ? round2(seg.puOverride! * qty) : ventile;

    // libelleOverride (renommage commercial) prend le pas sur le généré.
    const genere = isLibre ? seg.lbl || "Ligne libre" : labels.libelle(seg);
    const libelle = seg.libelleOverride?.trim() || genere;

    out.push({
      segmentId: seg.id,
      prestationKey: hl.key,
      libelleCommercial: libelle,
      libelleTechnique: hl.lbl,
      description: isLibre ? "" : labels.describe(seg),
      categorie: isLibre ? "Ligne libre" : labels.eyebrow(seg),
      qty,
      // Non-libre : m² par défaut, mais un segment peut porter son unité
      // (ex. plinthes parquet en ml). Libre : unité saisie (défaut "u").
      unit: isLibre ? seg.unit || "u" : seg.unit || "m²",
      prixClient,
      prixUnitaireClient: qty > 0 ? round2(prixClient / qty) : 0,
      tva: hl.tva ?? state.tvaParDefaut,
      afficheFourniture: false, // lots à segments ∉ LOTS_PRODUIT_FINI
      detailInterne: groupe,
    });
  }
  return out;
}

// ─── Cloisons : étiquetage spécifique ────────────────────────────────
const CLOISON_TYPE_LABELS: Record<string, string> = {
  std: "standard",
  hydro: "hydrofuge",
  hd: "haute dureté",
  feu: "coupe-feu",
};
const CLOISON_EYEBROW: Record<string, string> = {
  std: "BA13 standard",
  hydro: "BA13 hydrofuge",
  hd: "BA13 haute dureté",
  feu: "BA13 coupe-feu",
};
const CLOISON_EPA: Record<string, string> = { m48: "45", m70: "70", m90: "90" };
const CLOISON_PLAQUE: Record<string, string> = {
  std: "plaque BA13 standard",
  hydro: "plaque BA13 hydrofuge (pièces humides)",
  hd: "plaque BA13 haute dureté",
  feu: "plaque BA13 coupe-feu",
};

/**
 * Description client (phrase non technique) dérivée de la config du segment.
 * Affichage seul — n'impacte aucun calcul. Vide pour les segments `libre`.
 */
export function descriptionCloison(seg: CloisonSegment): string {
  if (seg.type === "libre") return "";
  const oss = String(seg.oss || "m48").toUpperCase();
  const renf = seg.dbl ? " renforcée" : "";
  const plaque = CLOISON_PLAQUE[seg.type] ?? "plaque BA13";
  const dbl = seg.peaux === "4" ? " en double épaisseur" : "";
  const iso =
    seg.isolant === "lv" || seg.isolant === "lr"
      ? `, isolation ${seg.isolant === "lv" ? "laine de verre" : "laine de roche"} ${CLOISON_EPA[seg.oss] ?? ""}mm`
      : "";
  return `Cloison sur ossature métallique ${oss}${renf}, ${plaque}${dbl}${iso}, finition prête à peindre.`;
}

function agregerCloisons(state: EngineState, lt: LotTotaux): LigneClient[] {
  return agregerSegments(state, lt, {
    eyebrow: (s) => CLOISON_EYEBROW[s.type] ?? "Cloison",
    libelle: (s) =>
      `Fourniture et pose de cloison BA13 ${
        CLOISON_TYPE_LABELS[s.type] ?? ""
      }`.trim(),
    describe: (s) => descriptionCloison(s as CloisonSegment),
  });
}

// ─── Faux-plafond : étiquetage spécifique ────────────────────────────
const FP_TYPE_LABELS: Record<string, string> = {
  std: "standard",
  hydro: "hydrofuge",
  feu: "coupe-feu",
  phon: "phonique",
};
const FP_EYEBROW: Record<string, string> = {
  std: "Plafond BA13 standard",
  hydro: "Plafond BA13 hydrofuge",
  feu: "Plafond BA13 coupe-feu",
  phon: "Plafond BA13 phonique",
};
const FP_ISO_LABELS: Record<string, string> = {
  lv45: "laine de verre 45mm",
  lr45: "laine de roche 45mm",
  lv100: "laine de verre 100mm",
  lr100: "laine de roche 100mm",
  ouate: "ouate de cellulose 100mm",
};

/** Description client d'un segment de faux-plafond (affichage seul). */
export function descriptionFauxPlafond(seg: FauxPlafondSegment): string {
  if (seg.type === "libre") return "";
  const plaque = FP_TYPE_LABELS[seg.type] ?? "standard";
  const dbl = seg.peaux === "2" ? " en double peau" : "";
  const iso =
    seg.isolant && seg.isolant !== "non"
      ? `, isolation ${FP_ISO_LABELS[seg.isolant] ?? ""}`
      : "";
  return `Faux-plafond suspendu sur ossature métallique, plaque BA13 ${plaque}${dbl}${iso}, finition prête à peindre.`;
}

function agregerFauxPlafond(state: EngineState, lt: LotTotaux): LigneClient[] {
  return agregerSegments(state, lt, {
    eyebrow: (s) => FP_EYEBROW[s.type] ?? "Faux-plafond",
    libelle: (s) =>
      `Fourniture et pose de faux-plafond BA13 ${
        FP_TYPE_LABELS[s.type] ?? ""
      }`.trim(),
    describe: (s) => descriptionFauxPlafond(s as FauxPlafondSegment),
  });
}

// ─── ITI : étiquetage spécifique (isolant = ligne hl, R affiché) ─────
const ITI_PAREMENT_LABEL: Record<string, string> = {
  ba13_std: "BA13 standard",
  ba13_hydro: "BA13 hydrofuge",
};

/** Description client d'un segment ITI (affichage seul). R indicatif (cf. iti.ts). */
export function descriptionIti(seg: ItiSegment): string {
  if (seg.type === "libre") return "";
  const iso = seg.type;
  const fam = ITI_FAMILLE_LABEL[iso];
  const r = itiRText(iso, seg.epa);
  const membrane = seg.membrane ? ", membrane frein-vapeur" : "";
  const parement =
    seg.parement && seg.parement !== "aucun"
      ? `, parement ${ITI_PAREMENT_LABEL[seg.parement] ?? "BA13"}`
      : "";
  return `Doublage isolé sur ossature Optima, ${fam} ${seg.epa}mm (R ≈ ${r} m².K/W)${membrane}${parement}, finition prête à peindre.`;
}

function agregerIti(state: EngineState, lt: LotTotaux): LigneClient[] {
  return agregerSegments(state, lt, {
    eyebrow: (s) => ITI_FAMILLE_LABEL[s.type as ItiIso] ?? "Isolation",
    libelle: (s) => {
      const seg = s as ItiSegment;
      const fam = ITI_FAMILLE_LABEL[seg.type as ItiIso] ?? "";
      return `Fourniture et pose de doublage isolé ${fam} ${seg.epa}mm`.trim();
    },
    describe: (s) => descriptionIti(s as ItiSegment),
  });
}

// ─── Peinture : étiquetage spécifique (deux familles) ────────────────
const PEINT_FINITION_LABEL: Record<string, string> = {
  mat: "mat",
  velours: "velours",
  satine: "satinée",
};

/** Passes effectives d'un segment surface (toile force 3, sinon 0..3). */
function peinturePasses(seg: PeintureSegment): number {
  const toile = seg.nature === "ancien" && !!seg.toile;
  return toile ? 3 : Math.min(3, Math.max(0, Number(seg.passes) || 0));
}

/** Libellé commercial d'un segment surface (les menuiseries `libre` portent
 *  leur propre `lbl`, ex. "Peinture de porte"). */
function libellePeinture(seg: PeintureSegment): string {
  const support = seg.support === "plafond" ? "plafond" : "mur";
  const nature = seg.nature === "ba13" ? "BA13" : "support ancien";
  const toile = seg.nature === "ancien" && !!seg.toile;
  const passes = peinturePasses(seg);
  const fin = PEINT_FINITION_LABEL[seg.finition || "mat"];
  const parts = [nature];
  if (toile) parts.push(`toile à enduire + ${passes} passes`);
  else if (passes > 0)
    parts.push(`${passes} passe${passes > 1 ? "s" : ""} d'enduit`);
  parts.push(`finition ${fin}`);
  return `Peinture ${support} — ${parts.join(", ")}`;
}

/** Description client d'un segment de peinture (affichage seul). */
export function descriptionPeinture(seg: PeintureSegment): string {
  if (seg.type === "libre") return "";
  const support = seg.support === "plafond" ? "plafond" : "mur";
  const nature = seg.nature === "ba13" ? "support BA13" : "support ancien";
  const toile = seg.nature === "ancien" && !!seg.toile;
  const passes = peinturePasses(seg);
  const fin = PEINT_FINITION_LABEL[seg.finition || "mat"];
  const enduit =
    passes > 0
      ? `${toile ? "toile à enduire et " : ""}${passes} passe${
          passes > 1 ? "s" : ""
        } d'enduit`
      : "sans enduit";
  return `Peinture ${support} sur ${nature}, ${enduit}, finition ${fin}.`;
}

function agregerPeinture(state: EngineState, lt: LotTotaux): LigneClient[] {
  return agregerSegments(state, lt, {
    eyebrow: (s) =>
      (s as PeintureSegment).support === "plafond"
        ? "Peinture plafond"
        : "Peinture mur",
    libelle: (s) => libellePeinture(s as PeintureSegment),
    describe: (s) => descriptionPeinture(s as PeintureSegment),
  });
}

// ─── Parquet : étiquetage spécifique (matériau / plinthes) ───────────
const PARQUET_MAT_LABEL: Record<string, string> = {
  strat: "stratifié",
  contre: "contrecollé",
  massif: "massif",
};
const PARQUET_EYEBROW: Record<string, string> = {
  strat: "Parquet stratifié",
  contre: "Parquet contrecollé",
  massif: "Parquet massif",
  plinthes: "Plinthes",
};
const PARQUET_DIM_LABEL: Record<string, string> = {
  etroite: "lame étroite (90 mm)",
  std: "lame standard (139 mm)",
  large: "lame large (190 mm)",
};
const PARQUET_SC_LABEL: Record<string, string> = {
  mousse: "sous-couche mousse",
  liege: "sous-couche liège",
};

/** Description client d'un segment parquet (affichage seul). */
export function descriptionParquet(seg: ParquetSegment): string {
  if (seg.type === "libre") return "";
  if (seg.type === "plinthes")
    return "Plinthes assorties au parquet, coupes et fixation comprises.";
  const mat = PARQUET_MAT_LABEL[seg.type] ?? "";
  const dim = seg.dim ? `, ${PARQUET_DIM_LABEL[seg.dim] ?? ""}` : "";
  const pose =
    seg.colle === "ms"
      ? ", pose collée (colle MS polymère)"
      : ", pose flottante";
  const sc =
    seg.sc && seg.sc !== "non" ? ` sur ${PARQUET_SC_LABEL[seg.sc]}` : "";
  return `Parquet ${mat}${dim}${pose}${sc}, coupes et finitions comprises.`;
}

function agregerParquet(state: EngineState, lt: LotTotaux): LigneClient[] {
  return agregerSegments(state, lt, {
    eyebrow: (s) => PARQUET_EYEBROW[s.type] ?? "Parquet",
    libelle: (s) =>
      s.type === "plinthes"
        ? "Fourniture et pose de plinthes assorties"
        : `Fourniture et pose de parquet ${
            PARQUET_MAT_LABEL[s.type] ?? ""
          }`.trim(),
    describe: (s) => descriptionParquet(s as ParquetSegment),
  });
}

// ─── Carrelage : étiquetage spécifique (type / plinthes / étanchéité) ─
const CARRELAGE_TYPE_LABEL: Record<string, string> = {
  ceram: "céramique standard",
  gres: "grès cérame rectifié",
  gf: "grand format",
};
const CARRELAGE_EYEBROW: Record<string, string> = {
  ceram: "Carrelage céramique",
  gres: "Grès cérame",
  gf: "Grand format",
  plinthes: "Plinthes",
  etancheite: "Étanchéité",
};
const CARRELAGE_COLLE_LABEL: Record<string, string> = {
  c2: "colle C2 standard",
  c2s: "colle C2S1 flex",
};

/** Description d'une option étanchéité (partagée carrelage / faïence). */
function descriptionEtancheite(mode: string | undefined, support: string): string {
  return (mode || "liquide") === "liquide"
    ? `Étanchéité liquide (SEL) sous ${support}, 2 couches croisées, angles et points singuliers traités.`
    : `Natte d'étanchéité sous ${support}, lés jointoyés et angles traités.`;
}

/** Description client d'un segment carrelage (affichage seul). */
export function descriptionCarrelage(seg: CarrelageSegment): string {
  if (seg.type === "libre") return "";
  if (seg.type === "plinthes")
    return "Plinthes carrelées assorties, coupes, collage et joints compris.";
  if (seg.type === "etancheite")
    return descriptionEtancheite(seg.mode, "carrelage");
  const t = CARRELAGE_TYPE_LABEL[seg.type] ?? "";
  const dim = seg.dim ? ` ${seg.dim.replace("x", "×")}` : "";
  const colle = seg.colle ? `, ${CARRELAGE_COLLE_LABEL[seg.colle] ?? ""}` : "";
  return `Carrelage ${t}${dim}, pose droite${colle}, joints et coupes compris.`;
}

function agregerCarrelage(state: EngineState, lt: LotTotaux): LigneClient[] {
  return agregerSegments(state, lt, {
    eyebrow: (s) => CARRELAGE_EYEBROW[s.type] ?? "Carrelage",
    libelle: (s) =>
      s.type === "plinthes"
        ? "Fourniture et pose de plinthes carrelées"
        : s.type === "etancheite"
          ? `Étanchéité sous carrelage — ${
              ((s as CarrelageSegment).mode || "liquide") === "liquide"
                ? "membrane liquide (SEL)"
                : "natte"
            }`
          : `Fourniture et pose de carrelage ${
              CARRELAGE_TYPE_LABEL[s.type] ?? ""
            }`.trim(),
    describe: (s) => descriptionCarrelage(s as CarrelageSegment),
  });
}

// ─── Faïence : étiquetage spécifique (type / étanchéité — pas de plinthes) ─
const FAIENCE_TYPE_LABEL: Record<string, string> = {
  fai: "standard",
  gres: "grès cérame mural rectifié",
  gf: "grand format mural",
};
const FAIENCE_EYEBROW: Record<string, string> = {
  fai: "Faïence standard",
  gres: "Grès cérame mural",
  gf: "Grand format mural",
  etancheite: "Étanchéité",
};

/** Description client d'un segment faïence (affichage seul). */
export function descriptionFaience(seg: FaienceSegment): string {
  if (seg.type === "libre") return "";
  if (seg.type === "etancheite")
    return descriptionEtancheite(seg.mode, "faïence");
  const t = FAIENCE_TYPE_LABEL[seg.type] ?? "";
  const dim = seg.dim ? ` ${seg.dim.replace("x", "×")}` : "";
  const colle = seg.colle
    ? `, ${CARRELAGE_COLLE_LABEL[seg.colle] ?? ""}`
    : "";
  const prim =
    seg.sc === "primaire" ? ", primaire d'accrochage" : "";
  return `Faïence ${t}${dim}, pose murale droite${colle}${prim}, joints et coupes compris.`;
}

function agregerFaience(state: EngineState, lt: LotTotaux): LigneClient[] {
  return agregerSegments(state, lt, {
    eyebrow: (s) => FAIENCE_EYEBROW[s.type] ?? "Faïence",
    libelle: (s) =>
      s.type === "etancheite"
        ? `Étanchéité sous faïence — ${
            ((s as FaienceSegment).mode || "liquide") === "liquide"
              ? "membrane liquide (SEL)"
              : "natte"
          }`
        : `Fourniture et pose de faïence ${
            FAIENCE_TYPE_LABEL[s.type] ?? ""
          }`.trim(),
    describe: (s) => descriptionFaience(s as FaienceSegment),
  });
}

// ─── Élec : agrégateur (lot à points + infrastructure) — DÉTAIL par appareillage ─
// PAS un lot à segments : infrastructure (déboursé) + points catalogue (prix
// ferme). UNE ligne client par prestation (qty>0), groupée par catégorie via
// l'eyebrow `categorie`. Σ lignes == caLot au centime. Chaque ligne porte sa
// décomposition CLIENT Fourniture/Pose (part matériel indicative, JAMAIS de
// donnée interne). Plus de mode forfait : le détail est le seul affichage.
const ELEC_CAT_CLIENT_LABEL: Record<string, string> = {
  prises: "Prises et sorties de câble",
  commandes: "Commandes",
  eclairage: "Points lumineux et éclairage",
};
const ELEC_INFRA_CATEGORIE = "Tableau et infrastructure";

/** Part fourniture indicative de l'infra (sur le TOTAL CLIENT du poste, jamais
 *  sur le déboursé BP). Tableau 60 %, GTL 50 %, VMC 65 %. Réseau & terre → pas
 *  de décompo (undefined). */
function infraFournPct(key: string): number | undefined {
  if (key.startsWith("elec_tableau_")) return 60;
  if (key === "elec_gtl") return 50;
  if (key.startsWith("elec_vmc_")) return 65;
  return undefined; // réseau, terre, consuel (inerte) : ligne simple
}

/** Décompose un total client en { fourniture, pose } selon un %. pose absorbe
 *  l'arrondi → fourniture + pose === total exactement. */
function splitFP(
  total: number,
  pct: number | undefined
): { fournitureClient?: number; poseClient?: number } {
  if (pct === undefined) return {};
  const fournitureClient = round2((total * pct) / 100);
  return { fournitureClient, poseClient: round2(total - fournitureClient) };
}

function agregerElec(state: EngineState, lt: LotTotaux): LigneClient[] {
  const tvaLot = state.lots.elec.tva ?? state.tvaParDefaut;
  const ctx = lotCAContext(lt);
  const out: LigneClient[] = [];

  // Override PONCTUEL par devis (o.pointsOverride). UNE seule map, keysets
  // disjoints : les clés d'INFRA commencent par "elec_" (it.key), les ids de
  // POINTS jamais (prise_*, va_et_vient, spot_led…). Voir anyOverride / le
  // discriminant "elec_". L'override d'une ligne (pu / lbl) ne touche QUE cette
  // ligne (jamais le catalogue ni les prix BP).
  const overrides =
    (state.lots.elec.o.pointsOverride as
      | Record<string, { pu?: number; lbl?: string }>
      | undefined) || {};
  const isOverridden = (ov?: { pu?: number; lbl?: string }) =>
    !!(
      ov &&
      ((typeof ov.pu === "number" && ov.pu >= 0) ||
        (typeof ov.lbl === "string" && ov.lbl.trim()))
    );

  // (A) INFRASTRUCTURE : une ligne client par poste déboursé. On calcule d'abord
  //     les naturalCA ventilés (1re ligne absorbe le reliquat d'arrondi + orphan
  //     → Σ naturalCA = caDeboursé au centime), PUIS on applique l'override :
  //     une ligne avec `pu` voit son prix client FORCÉ à pu × qty ; les autres
  //     gardent leur quote-part → AUCUNE redistribution de MO (pas de conversion
  //     en prix ferme côté moteur). Σ lignes = caDeboursé − Σ naturalCA des lignes
  //     overridées + Σ pu×qty ; le HT lot est recomposé depuis les unités client
  //     par calcClientTotaux (chemin forcé via anyOverride sur clé "elec_").
  const infra = lt.items.filter((it) => !it.prixEstFinal);
  if (infra.length > 0) {
    const infraCAs = infra.map((it) => round2(lineClientCA(it, ctx)));
    const sommeInfra = round2(infraCAs.reduce((a, c) => a + c, 0));
    const reliquat = round2(lt.caDeboursé - sommeInfra);
    infra.forEach((it, i) => {
      const naturalCA = i === 0 ? round2(infraCAs[i] + reliquat) : infraCAs[i];
      const ov = overrides[it.key];
      const puOv =
        ov && typeof ov.pu === "number" && ov.pu >= 0 ? ov.pu : undefined;
      const ca = puOv !== undefined ? round2(puOv * it.qty) : naturalCA;
      const lblOv =
        ov && typeof ov.lbl === "string" && ov.lbl.trim()
          ? ov.lbl.trim()
          : undefined;
      out.push({
        segmentId: `elec_infra_${it.key}`,
        prestationKey: it.key,
        libelleCommercial: lblOv ?? it.lbl,
        libelleTechnique: it.lbl,
        description: it.note || "",
        categorie: ELEC_INFRA_CATEGORIE,
        qty: it.qty,
        unit: it.unit,
        prixClient: ca,
        prixUnitaireClient: it.qty > 0 ? round2(ca / it.qty) : ca,
        tva: (it.tva ?? tvaLot) as number,
        afficheFourniture: false,
        overrideKey: it.key,
        overridden: isOverridden(ov),
        detailInterne: [],
        ...splitFP(ca, infraFournPct(it.key)),
      });
    });
  }

  // (B) POINTS : UNE ligne par prestation (qty>0), dans l'ordre du catalogue
  //     (donc déjà groupées par catégorie). Eyebrow = catégorie client.
  //     Override ponctuel (o.pointsOverride) : le pu/libellé sont déjà appliqués
  //     sur la ligne moteur (`it.total` / `it.lbl`) par calc-items → on en dérive
  //     ici (DRY). `overrideKey`/`overridden` pilotent l'édition inline + reset.
  const pointItems = lt.items.filter((it) => it.prixEstFinal && it.prestationId);
  const itemById = new Map(pointItems.map((it) => [it.prestationId!, it]));
  for (const p of CATALOGUE_ELEC.prestations) {
    const it = itemById.get(p.id);
    const qty = Number(it?.qty) || 0;
    if (!it || qty <= 0) continue;
    const total = round2(it.total);
    const overridden = isOverridden(overrides[p.id]);
    out.push({
      segmentId: `elec_pt_${p.id}`,
      prestationKey: p.id,
      libelleCommercial: it.lbl, // override.lbl ?? catalogue (appliqué par calc-items)
      libelleTechnique: p.libelle,
      description: p.description,
      categorie: ELEC_CAT_CLIENT_LABEL[p.categorieId] ?? p.categorieId,
      qty,
      unit: p.unite,
      prixClient: total,
      prixUnitaireClient: qty > 0 ? round2(total / qty) : total,
      tva: (it.tva ?? tvaLot) as number,
      afficheFourniture: false,
      overrideKey: p.id,
      overridden,
      detailInterne: [],
      ...splitFP(total, p.partFourniturePct),
    });
  }

  return out;
}

// ════════════════════════════════════════════════════════════
// Registre par lot — lots à modèle "segments".
// ════════════════════════════════════════════════════════════
const STRATEGIES: Partial<
  Record<LotId, (state: EngineState, lt: LotTotaux) => LigneClient[]>
> = {
  cloisons: agregerCloisons,
  fauxplafond: agregerFauxPlafond,
  iti: agregerIti,
  peinture: agregerPeinture,
  parquet: agregerParquet,
  carrelage: agregerCarrelage,
  faience: agregerFaience,
  elec: agregerElec,
};

/**
 * Agrège les lignes d'un lot en lignes client.
 * @returns LigneClient[] si le lot a une stratégie (cloisons), sinon `null`
 *          → l'appelant conserve le rendu legacy ligne-à-ligne.
 */
export function agregerLignesClient(
  state: EngineState,
  lt: LotTotaux
): LigneClient[] | null {
  const strat = STRATEGIES[lt.lotId];
  return strat ? strat(state, lt) : null;
}

/** Ce lot a-t-il une stratégie d'agrégation (lignes client) ? */
export function hasAggregateur(lotId: LotId): boolean {
  return lotId in STRATEGIES;
}

/** Une ligne libre (prix de vente ferme, qty × pu) → ligne client. Partagé
 *  par les lignes libres d'un lot prédéfini (LotState.lignesLibres) et les
 *  lignes d'un lot libre (LotLibre.lignes). */
function ligneLibreToClient(l: LigneLibre, tva: number): LigneClient {
  const qty = Number(l.qty) || 0;
  const pu = Number(l.pu) || 0;
  const genere = l.lbl || "Ligne libre";
  return {
    segmentId: l.id,
    prestationKey: "_libre",
    libelleCommercial: l.libelleOverride?.trim() || genere,
    libelleTechnique: genere,
    description: "",
    qty,
    unit: l.unit || "u",
    prixClient: round2(qty * pu),
    prixUnitaireClient: pu,
    tva,
    afficheFourniture: false,
    detailInterne: [],
  };
}

/** Lignes client d'un lot libre (prix de vente ferme, qty × pu). */
export function lignesLotLibre(
  lot: LotLibre,
  tvaParDefaut: number
): LigneClient[] {
  return lot.lignes.map((l) => ligneLibreToClient(l, tvaParDefaut));
}

/** Lignes client LIBRES d'un lot prédéfini (additif, prix ferme). TVA reprise
 *  de l'override du lot le cas échéant, sinon tvaParDefaut. */
export function lignesLibresClient(
  lotState: { lignesLibres?: LigneLibre[]; tva?: number },
  tvaParDefaut: number
): LigneClient[] {
  const tva = lotState.tva ?? tvaParDefaut;
  return (lotState.lignesLibres ?? []).map((l) => ligneLibreToClient(l, tva));
}

// ════════════════════════════════════════════════════════════
// TOTAUX CLIENT (override-aware)
// ════════════════════════════════════════════════════════════
//
// Le HT d'un lot à agrégateur = somme des lignes client (donc override-aware).
// Tant qu'aucun puOverride n'existe nulle part, on renvoie tels quels les
// totaux globaux du moteur (Σ lignes = caLot) → zéro drift d'arrondi.

export interface ClientTotaux {
  /** HT client par lot — clé = LotId OU id de lot libre. */
  parLotClientHT: Record<string, number>;
  subTotalHT: number;
  remiseHT: number;
  totalHT: number;
  ventilationTVA: Record<number, number>;
  totalTVA: number;
  totalTTC: number;
  hasOverride: boolean;
}

// Réplique de la remise du moteur (privée dans totals.ts).
function remiseAmountClient(
  subTotalHT: number,
  mode: RemiseMode,
  valeur: number
): number {
  if (subTotalHT <= 0) return 0;
  if (mode === "pourcent")
    return Math.min(subTotalHT, subTotalHT * ((valeur || 0) / 100));
  if (mode === "euros") return Math.min(subTotalHT, Math.max(0, valeur || 0));
  return 0;
}

/** "Unités client" d'un lot : (montant HT, taux TVA). Inclut les lignes
 *  libres du lot (additif, prix ferme) après les prestations du moteur. */
function lotClientUnits(
  state: EngineState,
  lt: LotTotaux
): Array<{ amountHT: number; tva: number }> {
  const lignes = agregerLignesClient(state, lt);
  const units: Array<{ amountHT: number; tva: number }> = lignes
    ? lignes.map((lc) => ({ amountHT: lc.prixClient, tva: lc.tva }))
    : (() => {
        // Lot sans agrégateur : reproduit la ventilation par ligne du moteur
        // (MÊME formule que la ventilation TVA — lineClientCA / lotCAContext).
        const ctx = lotCAContext(lt);
        const u = lt.items.map((it) => ({
          amountHT: lineClientCA(it, ctx),
          tva: (it.tva ?? state.tvaParDefaut) as number,
        }));
        if (ctx.orphanCA > 0) {
          u.push({ amountHT: ctx.orphanCA, tva: state.tvaParDefaut });
        }
        return u;
      })();
  // Lignes libres du lot (prix ferme, additif) — TVA = override lot ou défaut.
  for (const lc of lignesLibresClient(state.lots[lt.lotId], state.tvaParDefaut)) {
    units.push({ amountHT: lc.prixClient, tva: lc.tva });
  }
  return units;
}

function anyOverride(state: EngineState): boolean {
  for (const lid of Object.keys(state.lots) as LotId[]) {
    if (!hasAggregateur(lid)) continue;
    const o = state.lots[lid].o;
    const segs = Array.isArray(o.lignes) ? (o.lignes as SegmentBase[]) : [];
    if (
      segs.some(
        (s) =>
          s.type !== "libre" &&
          typeof s.puOverride === "number" &&
          s.puOverride >= 0
      )
    )
      return true;
    // Override d'une ligne d'INFRA élec (clé "elec_*") : il vit UNIQUEMENT à
    // l'agrégation (pas dans les totaux moteur) → forcer le recalcul depuis les
    // unités client. Les POINTS (ids sans préfixe "elec_") sont déjà reflétés
    // dans les totaux moteur (calc-items) → fast-path conservé (zéro drift).
    const ov = o.pointsOverride as
      | Record<string, { pu?: number; lbl?: string }>
      | undefined;
    if (ov) {
      for (const [k, v] of Object.entries(ov)) {
        if (!k.startsWith("elec_")) continue;
        if (
          (typeof v.pu === "number" && v.pu >= 0) ||
          (typeof v.lbl === "string" && v.lbl.trim())
        )
          return true;
      }
    }
  }
  return false;
}

export function calcClientTotaux(
  state: EngineState,
  engineTotaux: DevisTotaux
): ClientTotaux {
  const active = engineTotaux.parLot.filter((l) => l.active);
  const parLotClientHT: Record<string, number> = {};
  for (const lt of active) {
    const units = lotClientUnits(state, lt);
    parLotClientHT[lt.lotId] = round2(
      units.reduce((a, u) => a + u.amountHT, 0)
    );
  }
  // Lots libres (prix ferme) : HT par lot libre.
  const lotsLibres = state.lotsLibres ?? [];
  for (const lot of lotsLibres) {
    const lignes = lignesLotLibre(lot, state.tvaParDefaut);
    parLotClientHT[lot.id] = round2(
      lignes.reduce((a, l) => a + l.prixClient, 0)
    );
  }
  // Contenu libre = lot libre non vide OU ligne libre sur un lot prédéfini ACTIF.
  const hasLibre =
    lotsLibres.some((l) => l.lignes.length > 0) ||
    active.some(
      (lt) => (state.lots[lt.lotId].lignesLibres ?? []).length > 0
    );

  // Sans override NI contenu libre : totaux globaux du moteur = vérité (pas de
  // recalcul) → garantit 0 drift (les chiffres validés ne bougent pas).
  if (!anyOverride(state) && !hasLibre) {
    return {
      parLotClientHT,
      subTotalHT: engineTotaux.subTotalHT,
      remiseHT: engineTotaux.remiseHT,
      totalHT: engineTotaux.totalHT,
      ventilationTVA: engineTotaux.ventilationTVA,
      totalTVA: engineTotaux.totalTVA,
      totalTTC: engineTotaux.totalTTC,
      hasOverride: false,
    };
  }

  // Avec override et/ou lot libre : on recompose depuis les unités client.
  const allUnits = [
    ...active.flatMap((lt) => lotClientUnits(state, lt)),
    ...lotsLibres.flatMap((lot) =>
      lignesLotLibre(lot, state.tvaParDefaut).map((l) => ({
        amountHT: l.prixClient,
        tva: l.tva,
      }))
    ),
  ];
  const subTotalHT = round2(allUnits.reduce((a, u) => a + u.amountHT, 0));
  const remiseHT = round2(
    remiseAmountClient(subTotalHT, state.remiseMode, state.remiseValeur)
  );
  const totalHT = round2(subTotalHT - remiseHT);
  const ratio = subTotalHT > 0 ? totalHT / subTotalHT : 1;
  const acc: Record<number, number> = {};
  for (const u of allUnits) {
    acc[u.tva] = (acc[u.tva] || 0) + u.amountHT * ratio * (u.tva / 100);
  }
  const ventilationTVA: Record<number, number> = {};
  let totalTVA = 0;
  for (const [taux, m] of Object.entries(acc)) {
    const r = round2(m);
    ventilationTVA[Number(taux)] = r;
    totalTVA += r;
  }
  totalTVA = round2(totalTVA);
  return {
    parLotClientHT,
    subTotalHT,
    remiseHT,
    totalHT,
    ventilationTVA,
    totalTVA,
    totalTTC: round2(totalHT + totalTVA),
    hasOverride: true,
  };
}

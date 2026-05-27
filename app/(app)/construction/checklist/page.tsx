"use client";

import { useEffect, useState } from "react";
import "./checklist.css";

/* ═══════════════════════════════════════
   TYPES
   ═══════════════════════════════════════ */
type Statut = "sasu" | "eurl" | "micro";

interface StepCost {
  sasu: number;
  eurl: number;
  micro: number;
}

interface StepLink {
  url: string;
  label: string;
}

interface Step {
  id: number;
  phase: 1 | 2 | 3;
  title: string;
  desc: string;
  cost: StepCost | null;
  link: StepLink;
  needed?: boolean;
}

interface State {
  status: Statut;
  done: Record<number, boolean>;
}

type CaAnswer = "low" | "mid" | "high";
type PatrimoineAnswer = "oui" | "non" | "nsp";
type EquipeAnswer = "solo" | "evolution";

interface ModalAnswers {
  ca?: CaAnswer;
  patrimoine?: PatrimoineAnswer;
  equipe?: EquipeAnswer;
}

/* ═══════════════════════════════════════
   STEPS — données de référence (verbatim)
   ═══════════════════════════════════════ */
const STEPS: Step[] = [
  { id: 1, phase: 1, title: "Choisir son statut juridique",
    desc: "Le choix structurant qui conditionne charges, fiscalité, protection patrimoniale et plafonds de CA. Utilise l'aide au choix ci-dessus si tu hésites.",
    cost: null,
    link: { url: "https://entreprendre.service-public.fr/vosdroits/F23844", label: "Comparer les statuts" }
  },
  { id: 2, phase: 1, title: "Vérifier ses qualifications professionnelles",
    desc: "En BTP la plupart des activités sont réglementées. Il faut justifier d'un diplôme (CAP, BP, BTS) ou de 3 ans d'expérience. Sans ça, immatriculation refusée.",
    cost: null,
    link: { url: "https://www.economie.gouv.fr/cedef/qualifications-artisanat", label: "Liste des qualifications" }
  },
  { id: 3, phase: 1, title: "Choisir et vérifier la disponibilité du nom",
    desc: "Recherche INPI pour vérifier que le nom n'est pas déposé en marque. Recherche INSEE pour l'unicité du nom d'entreprise.",
    cost: null,
    link: { url: "https://data.inpi.fr/", label: "Vérifier sur INPI" }
  },
  { id: 4, phase: 1, title: "Identifier son code NAF",
    desc: "Le code NAF est attribué par l'INSEE selon ton activité principale déclarée. Il détermine ta convention collective, certaines obligations et peut influencer ton assurance décennale. Codes BTP courants : 4321A Électricité, 4322A Plomberie, 4331Z Plâtrerie, 4332A Menuiserie, 4333Z Parquets, 4334Z Peinture, 4339Z Autres finitions, 4120A Construction maisons, 4399B Maçonnerie.",
    cost: null,
    link: { url: "https://www.insee.fr/fr/information/2120875", label: "Nomenclature NAF — INSEE" }
  },
  { id: 5, phase: 1, title: "Préparer le dossier d'immatriculation",
    desc: "SASU/EURL : statuts rédigés, capital déposé sur compte bloqué, justificatif domicile siège, attestation non-condamnation. Micro : formulaire P0 simplifié en ligne.",
    cost: { sasu: 250, eurl: 200, micro: 0 },
    link: { url: "https://www.formalites.entreprises.gouv.fr/", label: "Guichet unique" }
  },
  { id: 6, phase: 2, title: "Ouvrir un compte bancaire professionnel",
    desc: "Obligatoire pour SASU/EURL dès le KBIS reçu. Recommandé pour micro-entrepreneur dès 10 000 € de CA. Compare les néobanques (Qonto, Shine) vs banques traditionnelles.",
    cost: { sasu: 240, eurl: 240, micro: 60 },
    link: { url: "https://www.qonto.com/fr", label: "Comparer les comptes pro" }
  },
  { id: 7, phase: 2, title: "Souscrire l'assurance RC Pro",
    desc: "Obligatoire avant tout démarrage d'activité. Couvre les dommages causés à des tiers pendant l'activité professionnelle.",
    cost: { sasu: 450, eurl: 450, micro: 350 },
    link: { url: "https://www.april.fr/professionnels/assurance-rc-pro", label: "Comparer les assureurs" }
  },
  { id: 8, phase: 2, title: "Souscrire la Garantie Décennale",
    desc: "Obligation légale absolue en BTP. Démarrer un chantier sans décennale est un délit. Couvre les dommages pendant 10 ans après réception. Coût variable selon corps d'état.",
    cost: { sasu: 2200, eurl: 2200, micro: 1800 },
    link: { url: "https://www.hiscox.fr/garantie-decennale", label: "Devis décennale en ligne" },
    needed: true
  },
  { id: 9, phase: 2, title: "S'inscrire à la Chambre de Métiers",
    desc: "Obligatoire pour les activités artisanales. Le Stage de Préparation à l'Installation (SPI) n'est plus obligatoire depuis 2019 mais reste recommandé.",
    cost: { sasu: 130, eurl: 130, micro: 0 },
    link: { url: "https://www.artisanat.fr/", label: "CMA — site officiel" }
  },
  { id: 10, phase: 2, title: "Affilier l'entreprise à l'OPPBTP et PRO BTP",
    desc: "OPPBTP (prévention) : obligatoire dès le premier salarié, recommandé même solo. PRO BTP : caisse de retraite, congés payés, prévoyance, obligatoire dès embauche.",
    cost: null,
    link: { url: "https://www.preventionbtp.fr/", label: "OPPBTP" }
  },
  { id: 11, phase: 3, title: "Configurer son taux horaire et sa marge",
    desc: "Calcule ton taux horaire viable (salaire net souhaité + charges + jours non facturables) et définis ta marge objectif. La TVA applicable se configure aussi maintenant.",
    cost: null,
    link: { url: "#", label: "Simulateur de taux horaire" }
  },
  { id: 12, phase: 3, title: "Préparer ses modèles de devis et CGV",
    desc: "Conditions Générales de Vente conformes avec mentions obligatoires. Modèle de devis avec SIREN, RM, N° d'assurance décennale, TVA, délai de rétractation 14j pour particuliers.",
    cost: null,
    link: { url: "#", label: "Générateur de devis" }
  },
  { id: 13, phase: 3, title: "Mettre en place sa comptabilité",
    desc: "Choisir entre tenir sa compta soi-même (Pennylane, Indy, Tiime) ou prendre un expert-comptable. Décision structurante à prendre avant le premier devis.",
    cost: { sasu: 1200, eurl: 1000, micro: 300 },
    link: { url: "https://www.indy.fr/", label: "Comparer les solutions" }
  },
];

const STORAGE_KEY = "socle_lancement";
const DEFAULT_STATE: State = { status: "sasu", done: {} };

const PHASE_META: { phase: 1 | 2 | 3; label: string }[] = [
  { phase: 1, label: "Phase 1 · Avant immat." },
  { phase: 2, label: "Phase 2 · Après immat." },
  { phase: 3, label: "Phase 3 · Avant chantier" },
];

const PHASE_SECTIONS: { phase: 1 | 2 | 3; number: string; title: string; sub: string }[] = [
  { phase: 1, number: "Phase 01", title: "Avant l'immatriculation",
    sub: "Les décisions et préparatifs à faire avant de déposer ton dossier au greffe." },
  { phase: 2, number: "Phase 02", title: "Après l'immatriculation",
    sub: "Tout ce qui se met en place dans les 30 jours qui suivent ton KBIS." },
  { phase: 3, number: "Phase 03", title: "Avant le premier chantier",
    sub: "Les éléments opérationnels pour facturer légalement et commencer à travailler." },
];

const STATUT_OPTIONS: { value: Statut; label: string }[] = [
  { value: "sasu", label: "Statut : SASU" },
  { value: "eurl", label: "Statut : EURL" },
  { value: "micro", label: "Statut : Micro-entrepreneur" },
];

function fmt(n: number): string {
  return n.toLocaleString("fr-FR");
}

export default function ChecklistPage() {
  // Initialise avec les mêmes valeurs par défaut que l'original (pas de lecture
  // de localStorage au rendu → évite les mismatch d'hydratation Next.js).
  const [state, setState] = useState<State>(DEFAULT_STATE);
  const [hydrated, setHydrated] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalAnswers, setModalAnswers] = useState<ModalAnswers>({});

  // loadState : lecture localStorage après montage
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as Partial<State>;
        setState((prev) => ({ ...prev, ...parsed }));
      }
    } catch {
      /* ignore */
    }
    setHydrated(true);
  }, []);

  // saveState : persistance, en miroir de l'original (après le 1er montage seulement)
  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      /* ignore */
    }
  }, [state, hydrated]);

  // Verrouille le scroll du body quand la modale est ouverte (comme l'original)
  useEffect(() => {
    document.body.style.overflow = modalOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [modalOpen]);

  /* ─── toggleStep ─── */
  const toggleStep = (id: number) => {
    setState((prev) => ({
      ...prev,
      done: { ...prev.done, [id]: !prev.done[id] },
    }));
  };

  /* ─── updateBudget (changement de statut) ─── */
  const updateStatus = (status: Statut) => {
    setState((prev) => ({ ...prev, status }));
  };

  /* ─── updateProgress (calculs dérivés) ─── */
  const total = STEPS.length;
  const phaseCounts: Record<number, number> = { 1: 0, 2: 0, 3: 0 };
  const phaseDone: Record<number, number> = { 1: 0, 2: 0, 3: 0 };
  let done = 0;
  STEPS.forEach((s) => {
    phaseCounts[s.phase]++;
    if (state.done[s.id]) {
      done++;
      phaseDone[s.phase]++;
    }
  });
  const pct = total > 0 ? (done / total) * 100 : 0;
  const allDone = done === total;

  const phaseMiniClass = (p: 1 | 2 | 3) => {
    if (phaseDone[p] === phaseCounts[p]) return "phase-mini done";
    if (phaseDone[p] > 0) return "phase-mini active";
    return "phase-mini";
  };

  /* ─── renderBudget (lignes + total) ─── */
  const budgetLines = STEPS.filter((s) => s.cost && s.cost[state.status]).map((s) => ({
    title: s.title,
    amount: (s.cost as StepCost)[state.status],
  }));
  const budgetTotal = budgetLines.reduce((sum, l) => sum + l.amount, 0);

  /* ─── modale : sélection d'une option ─── */
  const selectOpt = <K extends keyof ModalAnswers>(q: K, v: ModalAnswers[K]) => {
    setModalAnswers((prev) => ({ ...prev, [q]: v }));
  };

  /* ─── checkRecommendation + showRecommendation ─── */
  const { ca, patrimoine, equipe } = modalAnswers;
  const recommendationReady = Boolean(ca && patrimoine && equipe);

  let recommendation = "";
  let reasoning = "";
  if (recommendationReady) {
    if (ca === "low" && patrimoine !== "oui" && equipe === "solo") {
      recommendation = "Micro-entrepreneur";
      reasoning = "Avec un CA prévu sous 40 000 € et une activité solo, la micro-entreprise est la solution la plus simple et la moins coûteuse. Charges sociales réduites (~22%), comptabilité ultra-simplifiée, création gratuite. Tu pourras toujours basculer en SASU ou EURL plus tard si ton activité grossit.";
    } else if (ca === "high" || (patrimoine === "oui" && equipe === "evolution")) {
      recommendation = "SASU";
      reasoning = "La SASU offre la meilleure combinaison protection patrimoniale + flexibilité d'évolution. Tu seras assimilé salarié (meilleure protection sociale, mais charges plus élevées ~80%). Idéale si tu prévois de grossir, de prendre des salariés, ou de te verser des dividendes pour optimiser ta fiscalité.";
    } else if (patrimoine === "oui") {
      // ca !== "high" implicite : la branche ca === "high" a déjà été traitée plus haut
      recommendation = "EURL";
      reasoning = "L'EURL protège ton patrimoine personnel tout en gardant des charges sociales modérées (~45% en TNS). C'est un bon compromis si tu veux la sécurité juridique d'une société sans le coût social de la SASU. Tu peux opter pour l'IS pour optimiser la fiscalité.";
    } else {
      recommendation = "EURL";
      reasoning = "L'EURL est un statut équilibré pour ton profil : protection patrimoniale, plafond de CA illimité, fiscalité modulable (IR ou IS). Bon choix par défaut si tu n'es pas dans un cas extrême.";
    }
  }

  const openModal = () => setModalOpen(true);
  const closeModal = () => setModalOpen(false);

  return (
    <div className="checklist-tool">
      <div className="container">
        <div className="page-header">
          <div className="page-tag">Bloc 1 sur 4 · Lancement</div>
          <h1 className="page-title">
            Lance ton <span className="accent">entreprise</span>
            <br />
            du BTP.
          </h1>
          <p className="page-sub">
            13 étapes pour démarrer ton activité dans les règles, structurées en 3 phases.
            Avance à ton rythme — SOCLE garde ta progression.
          </p>
        </div>

        {/* Completion banner */}
        <div className={"completion-banner" + (allDone ? " visible" : "")}>
          <div className="completion-icon">
            <i className="ti ti-circle-check" aria-hidden="true"></i>
          </div>
          <div className="completion-content">
            <div className="completion-title">Toutes les étapes sont validées</div>
            <div className="completion-desc">
              Tu peux masquer ce bloc — il restera accessible depuis le menu.
            </div>
          </div>
          <button
            className="btn-secondary"
            onClick={() => alert("Bloc Lancement masqué — fonctionnalité à venir")}
          >
            Masquer ce bloc
          </button>
        </div>

        {/* Progress */}
        <div className="card progress-card">
          <div className="progress-top">
            <div className="progress-label">Progression globale</div>
            <div className="progress-count">{done} / 13 étapes</div>
          </div>
          <div className="progress-track">
            <div className="progress-fill" style={{ width: pct + "%" }}></div>
          </div>
          <div className="progress-phases">
            {PHASE_META.map(({ phase, label }) => (
              <div key={phase} className={phaseMiniClass(phase)}>
                <div className="phase-mini-dot"></div>
                <span>
                  {label} ({phaseDone[phase]}/{phaseCounts[phase]})
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Budget */}
        <div className="card budget-card">
          <div className="budget-head">
            <div className="budget-title">
              <i className="ti ti-wallet" aria-hidden="true"></i>
              <span>Budget de lancement estimé</span>
            </div>
            <select
              className="budget-status-select"
              value={state.status}
              onChange={(e) => updateStatus(e.target.value as Statut)}
            >
              {STATUT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div className="budget-lines">
            {budgetLines.map((l) => (
              <div key={l.title} className="budget-line">
                <span>{l.title}</span>
                <span className="budget-line-amount">{fmt(l.amount)} €</span>
              </div>
            ))}
          </div>
          <div className="budget-total">
            <div className="budget-total-label">Total estimé</div>
            <div className="budget-total-amount">{fmt(budgetTotal)} €</div>
          </div>
        </div>

        {/* Help CTA */}
        <div className="help-cta">
          <div className="help-cta-content">
            <div className="help-cta-eyebrow">Tu hésites sur le statut ?</div>
            <div className="help-cta-title">
              Trouve le statut adapté à ta situation en 30 secondes
            </div>
            <div className="help-cta-desc">
              Réponds à 3 questions, on te recommande le bon statut avec un comparatif détaillé.
            </div>
          </div>
          <button className="btn-primary" onClick={openModal}>
            Aide au choix
            <i className="ti ti-arrow-right" aria-hidden="true"></i>
          </button>
        </div>

        {/* Phases */}
        {PHASE_SECTIONS.map((section) => (
          <div className="phase" key={section.phase}>
            <div className="phase-header">
              <div className="phase-number">{section.number}</div>
              <div className="phase-title">{section.title}</div>
            </div>
            <div className="phase-sub">{section.sub}</div>
            <div>
              {STEPS.filter((s) => s.phase === section.phase).map((s) => {
                const isDone = state.done[s.id] === true;
                const cost = s.cost ? s.cost[state.status] : null;
                return (
                  <div
                    key={s.id}
                    className={"step" + (isDone ? " done" : "")}
                    onClick={(e) => {
                      const target = e.target as HTMLElement;
                      if (target.tagName !== "A" && !target.closest("a")) {
                        toggleStep(s.id);
                      }
                    }}
                  >
                    <div className="step-checkbox">
                      <i className="ti ti-check step-check-icon" aria-hidden="true"></i>
                    </div>
                    <div className="step-content">
                      <div className="step-head">
                        <span className="step-num">{String(s.id).padStart(2, "0")}</span>
                        <div className="step-title">{s.title}</div>
                      </div>
                      <div className="step-desc">{s.desc}</div>
                      <div className="step-meta">
                        {cost ? (
                          <span className="badge badge-cost">~{fmt(cost)} €</span>
                        ) : null}
                        {s.needed ? (
                          <span className="badge badge-required">Obligatoire</span>
                        ) : null}
                        {s.link ? (
                          <a
                            href={s.link.url}
                            target="_blank"
                            rel="noopener"
                            className="step-link"
                          >
                            {s.link.label}
                            <i className="ti ti-external-link" aria-hidden="true"></i>
                          </a>
                        ) : null}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Modal status helper */}
      <div
        className={"modal-overlay" + (modalOpen ? " visible" : "")}
        onClick={(e) => {
          if (e.target === e.currentTarget) closeModal();
        }}
      >
        <div className="modal">
          <button className="modal-close" onClick={closeModal} aria-label="Fermer">
            <i className="ti ti-x" aria-hidden="true"></i>
          </button>
          <h2 className="modal-title">Quel statut pour ton activité BTP ?</h2>
          <p className="modal-sub">3 questions, une recommandation argumentée.</p>

          <div className="modal-step">
            <div className="modal-step-label">01 · Quel CA vises-tu en première année ?</div>
            <div className="modal-options">
              <button
                className={"modal-option" + (ca === "low" ? " selected" : "")}
                onClick={() => selectOpt("ca", "low")}
              >
                Moins de 40 000 €
              </button>
              <button
                className={"modal-option" + (ca === "mid" ? " selected" : "")}
                onClick={() => selectOpt("ca", "mid")}
              >
                Entre 40 000 € et 80 000 €
              </button>
              <button
                className={"modal-option" + (ca === "high" ? " selected" : "")}
                onClick={() => selectOpt("ca", "high")}
              >
                Plus de 80 000 €
              </button>
            </div>
          </div>

          <div className="modal-step">
            <div className="modal-step-label">
              02 · Tu veux protéger ton patrimoine personnel ?
            </div>
            <div className="modal-options">
              <button
                className={"modal-option" + (patrimoine === "oui" ? " selected" : "")}
                onClick={() => selectOpt("patrimoine", "oui")}
              >
                Oui, c'est important
              </button>
              <button
                className={"modal-option" + (patrimoine === "non" ? " selected" : "")}
                onClick={() => selectOpt("patrimoine", "non")}
              >
                Pas indispensable
              </button>
              <button
                className={"modal-option" + (patrimoine === "nsp" ? " selected" : "")}
                onClick={() => selectOpt("patrimoine", "nsp")}
              >
                Je ne sais pas
              </button>
            </div>
          </div>

          <div className="modal-step">
            <div className="modal-step-label">
              03 · Tu prévois de travailler seul ou avec des associés/salariés ?
            </div>
            <div className="modal-options">
              <button
                className={"modal-option" + (equipe === "solo" ? " selected" : "")}
                onClick={() => selectOpt("equipe", "solo")}
              >
                Solo pour l'instant
              </button>
              <button
                className={"modal-option" + (equipe === "evolution" ? " selected" : "")}
                onClick={() => selectOpt("equipe", "evolution")}
              >
                Solo mais équipe envisagée
              </button>
            </div>
          </div>

          <div className={"modal-recommend" + (recommendationReady ? " visible" : "")}>
            <div className="recommend-eyebrow">Recommandation</div>
            <div className="recommend-title">
              {recommendation ? "→ " + recommendation : "—"}
            </div>
            <div className="recommend-desc">{reasoning || "—"}</div>

            <table className="compare-table">
              <thead>
                <tr>
                  <th>Critère</th>
                  <th>Micro</th>
                  <th>EURL</th>
                  <th>SASU</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Plafond CA</td>
                  <td className="v-mono v-bad">77 700 €</td>
                  <td className="v-good">Illimité</td>
                  <td className="v-good">Illimité</td>
                </tr>
                <tr>
                  <td>Charges sociales</td>
                  <td className="v-mono v-good">~22%</td>
                  <td className="v-mono">~45%</td>
                  <td className="v-mono">~80%</td>
                </tr>
                <tr>
                  <td>Protection patrimoine</td>
                  <td className="v-bad">Limitée</td>
                  <td className="v-good">Oui</td>
                  <td className="v-good">Oui</td>
                </tr>
                <tr>
                  <td>Comptabilité</td>
                  <td className="v-good">Très simple</td>
                  <td>Complète</td>
                  <td>Complète</td>
                </tr>
                <tr>
                  <td>Coût création</td>
                  <td className="v-mono v-good">~0 €</td>
                  <td className="v-mono">~200 €</td>
                  <td className="v-mono">~250 €</td>
                </tr>
                <tr>
                  <td>Régime social</td>
                  <td>TNS</td>
                  <td>TNS</td>
                  <td className="v-good">Assimilé salarié</td>
                </tr>
              </tbody>
            </table>

            <div className="disclaimer">
              <strong>Important.</strong> Cette recommandation est indicative. Le choix du
              statut a des implications fiscales et juridiques durables — consulte un
              expert-comptable avant de finaliser ton choix.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

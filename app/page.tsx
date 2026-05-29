import Link from "next/link";
import RevealInit from "@/components/RevealInit";
import TauxDemo from "@/components/landing/TauxDemo";
import "./landing.css";

type Card = { href: string; name: string; desc: string };

const AVANT: Card[] = [
  {
    href: "/construction/parametres",
    name: "Aide au choix du statut",
    desc: "Micro, EURL ou SASU comparés selon ta situation : revenus, charges, protection.",
  },
  {
    href: "/construction/checklist",
    name: "Guide d'ouverture d'entreprise",
    desc: "Un guide pas-à-pas : 13 étapes, 3 phases, budget estimé. Rien d'oublié, dans le bon ordre.",
  },
  {
    href: "/construction/cgv",
    name: "CGV et mentions légales",
    desc: "Conditions de vente et mentions conformes aux usages du BTP.",
  },
];

const PENDANT: Card[] = [
  {
    href: "/construction/taux-horaire",
    name: "Taux horaire viable",
    desc: "Salaire net visé + charges + jours non facturables. Le vrai prix de ton heure.",
  },
  {
    href: "/chantier/materiaux",
    name: "Chiffrage matériaux par lot",
    desc: "Prix réels fournisseurs, lot par lot. Pas du théorique, du terrain.",
  },
  {
    href: "/chantier/rentabilite",
    name: "Rentabilité chantier",
    desc: "Du déboursé sec à la marge, jusqu'au prix de vente. Tu sais ce que tu gagnes.",
  },
  {
    href: "/chantiers",
    name: "Chantiers & devis",
    desc: "Pilote tes chantiers et crée tes devis conformes, prêts à envoyer en PDF.",
  },
];

const APRES: Card[] = [
  {
    href: "/apres/pv-reception",
    name: "PV de réception conforme",
    desc: "Conforme, avec réserve ou refus — point par point. Tu réceptionnes sans risque.",
  },
  {
    href: "/apres/dtu",
    name: "Bibliothèque DTU",
    desc: "Les points critiques par corps d'état, pour rester dans les règles de l'art.",
  },
  {
    href: "/construction/previsionnel",
    name: "Prévisionnel financier",
    desc: "Suis ta rentabilité dans le temps et anticipe les mois creux.",
  },
];

function CardGrid({ cards, cols = 3 }: { cards: Card[]; cols?: 2 | 3 }) {
  return (
    <div className={`parcours-grid cols-${cols} reveal`}>
      {cards.map((c, i) => (
        <Link key={c.href} href={c.href} className="parcours-card">
          <div className="parcours-num">{String(i + 1).padStart(2, "0")}</div>
          <div className="parcours-card-name">{c.name}</div>
          <p className="parcours-card-desc">{c.desc}</p>
          <span className="parcours-card-arrow">→</span>
        </Link>
      ))}
    </div>
  );
}

export default function Home() {
  return (
    <div className="landing">
      <RevealInit />

      {/* NAV */}
      <nav>
        <Link href="/" className="nav-logo">
          SOCLE<span />
        </Link>
        <div className="nav-links">
          <a href="#parcours">Outils</a>
          <Link href="/dashboard" className="nav-cta">
            Accéder à SOCLE →
          </Link>
        </div>
      </nav>

      {/* §1 — HERO */}
      <section className="hero">
        <div className="hero-tag">Pour les créateurs d&apos;entreprise BTP</div>
        <h1 className="hero-title">
          De l&apos;immatriculation au premier chantier rentable.
        </h1>
        <p className="hero-sub">
          SOCLE — le kit de lancement du créateur BTP.
        </p>
        <div className="hero-actions">
          <a href="#demo" className="btn-primary">
            Essayer la démo <span className="arrow">→</span>
          </a>
          <a href="#parcours" className="btn-ghost">
            Voir les outils
          </a>
        </div>
        <div className="hero-note">
          Accès bêta gratuit · Sans inscription · Sans carte bancaire
        </div>
      </section>

      <hr className="divider" />

      {/* §2 — AVANT */}
      <section className="section parcours-section" id="parcours">
        <div className="section-tag">01 — Avant</div>
        <h2 className="section-title">Tu lances ton entreprise</h2>
        <p className="section-sub">
          Choisir le bon statut. Préparer les bons papiers. Souscrire les bonnes
          assurances. Dans l&apos;ordre.
        </p>
        <CardGrid cards={AVANT} />
      </section>

      <hr className="divider" />

      {/* §3 — PENDANT */}
      <section className="section parcours-section">
        <div className="section-tag">02 — Pendant</div>
        <h2 className="section-title">Tu fais ton premier chantier</h2>
        <p className="section-sub">
          Le bon taux horaire. Le bon prix. Le bon devis. La bonne marge.
        </p>
        <CardGrid cards={PENDANT} cols={2} />
      </section>

      <hr className="divider" />

      {/* §4 — APRÈS */}
      <section className="section parcours-section">
        <div className="section-tag">03 — Après</div>
        <h2 className="section-title">Tu sécurises et tu pilotes</h2>
        <p className="section-sub">
          Réceptionner sans risque. Connaître les DTU. Préparer la suite.
        </p>
        <CardGrid cards={APRES} />
      </section>

      <hr className="divider" />

      {/* §5 — DÉMO INTERACTIVE */}
      <section className="section" id="demo">
        <div className="section-tag">04 — Essaie</div>
        <h2 className="section-title">Essaie tout de suite. Sans inscription.</h2>
        <p className="section-sub">
          Calcule ton taux horaire viable. En 30 secondes, tu sauras à combien tu
          dois facturer pour ne pas travailler à perte.
        </p>
        <TauxDemo />
      </section>

      <hr className="divider" />

      {/* §6 — MANIFESTE */}
      <section className="section manifesto">
        <div className="section-tag">05 — Pourquoi</div>
        <h2 className="section-title">Pourquoi j&apos;ai créé SOCLE</h2>
        <div className="manifesto-body">
          <p>
            Je suis artisan. J&apos;ai lancé ma boîte. J&apos;ai galéré comme tout
            le monde — pas sur les chantiers, mais sur tout le reste.
          </p>
          <p>
            Les outils qui existent sont faits pour des grosses entreprises, ou pour
            des comptables. Pas pour nous, ceux qui démarrent seuls et qui apprennent
            la gestion sur le tas.
          </p>
          <p>
            J&apos;ai construit SOCLE comme l&apos;outil que j&apos;aurais voulu
            avoir quand j&apos;ai commencé. Celui qui répond aux vraies questions :
            quel statut, quel taux, quelle marge, quel risque.
          </p>
          <p>
            Brutal sur les chiffres, simple sur l&apos;interface, honnête sur les
            marges. Pas de promesse de t&apos;enrichir. Juste de quoi piloter sans te
            tromper.
          </p>
          <div className="manifesto-sign">— Benjamin, artisan &amp; fondateur</div>
        </div>
      </section>

      {/* §7 — CTA FINAL */}
      <div className="cta-section reveal">
        <div className="cta-text">
          <div className="cta-title">Commence quand tu es prêt.</div>
          <p className="cta-sub">
            L&apos;accès bêta est gratuit. Sans carte bancaire. Sans engagement.
          </p>
        </div>
        <div className="cta-actions">
          <Link href="/dashboard" className="btn-primary">
            Accéder à SOCLE <span className="arrow">→</span>
          </Link>
          <a href="#demo" className="cta-ghost">
            Refaire la démo
          </a>
        </div>
      </div>

      {/* FOOTER */}
      <footer>
        <div className="footer-logo">
          SOCLE<span />
        </div>
        <div className="footer-tagline">Conçu par un artisan, pour les artisans</div>
        <div className="footer-meta">© 2026 · Fait en France</div>
      </footer>
    </div>
  );
}

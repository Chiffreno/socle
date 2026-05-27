import Link from "next/link";
import RevealInit from "@/components/RevealInit";
import "./landing.css";

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
          <a href="#outils">Outils</a>
          <a href="#pour-qui">Pour qui</a>
          <a href="#tarifs">Tarifs</a>
          <Link href="/dashboard" className="nav-cta">
            Accès bêta →
          </Link>
        </div>
      </nav>

      {/* HERO */}
      <section className="hero">
        <div className="hero-tag">Pour les entrepreneurs BTP</div>
        <h1 className="hero-title">
          Pilotez
          <br />
          votre
          <br />
          <em>activité.</em>
        </h1>
        <p className="hero-sub">
          <strong>
            Chiffrage matériaux, marge chantier, devis client, réception
            terrain.
          </strong>
          <br />
          Tout ce qu&apos;il faut pour démarrer et rester rentable — sans usine à
          gaz.
        </p>
        <div className="hero-actions">
          <Link href="/dashboard" className="btn-primary">
            Accès bêta gratuit <span className="arrow">→</span>
          </Link>
          <a href="#outils" className="btn-ghost">
            Voir les outils
          </a>
        </div>
        <div className="hero-note">
          14 jours gratuits · Pas de carte bancaire · Annulable à tout moment
        </div>
      </section>

      <hr className="divider" />

      {/* DOULEURS */}
      <section className="section" id="douleurs">
        <div className="section-tag">Le problème</div>
        <div className="pain-list">
          {[
            {
              n: "01",
              t: "Tu poses un prix au feeling",
              s: "Et tu découvres que tu travailles à perte à mi-chantier",
            },
            {
              n: "02",
              t: "Le client te demande un prix, tu tâtonnes",
              s: "Trop haut tu perds le chantier, trop bas tu te fais mal",
            },
            {
              n: "03",
              t: "Ton devis ne ressemble à rien",
              s: "Fait sur Word en 2h, sans les mentions légales obligatoires",
            },
            {
              n: "04",
              t: "Tu ne sais pas si tu es dans les clous DTU",
              s: "Et en cas de litige, c'est ta décennale qui trinque",
            },
            {
              n: "05",
              t: "Tu démarres sans savoir à combien facturer ton heure",
              s: "Un taux trop bas, et tu travailles pour rien dès le premier mois",
            },
          ].map((p) => (
            <div className="pain-item reveal" key={p.n}>
              <span className="pain-num">{p.n}</span>
              <div>
                <div className="pain-text">{p.t}</div>
                <div className="pain-sub">{p.s}</div>
              </div>
              <span className="pain-tag-resolved">Résolu</span>
            </div>
          ))}
        </div>
      </section>

      <hr className="divider" />

      {/* OUTILS */}
      <section className="section" id="outils">
        <div className="section-tag">Les outils</div>
        <div className="tools-grid">
          {[
            {
              n: "01",
              name: "Chiffrage matériaux",
              desc: "Prix réels fournisseurs lot par lot. ManoMano, Bricoman, Point.P. Pas du Batiprix théorique.",
              badge: "live" as const,
              label: "Disponible",
            },
            {
              n: "02",
              name: "Rentabilité chantier",
              desc: "Déboursé sec → frais généraux → marge → prix de vente. Méthode Batiprix adaptée au terrain.",
              badge: "live" as const,
              label: "Disponible",
            },
            {
              n: "03",
              name: "Générateur de devis",
              desc: "Devis PDF conforme en 3 minutes. Mentions légales, TVA BTP, assurance décennale. Prêt à envoyer.",
              badge: "soon" as const,
              label: "Bientôt",
            },
            {
              n: "04",
              name: "Bibliothèque DTU",
              desc: "Points de contrôle critiques par corps d'état. Alertes décennales. Formulées pour le chantier, pas pour un bureau.",
              badge: "live" as const,
              label: "Disponible",
            },
            {
              n: "05",
              name: "PV de réception",
              desc: "Conforme / Réserve / Refus par point. Photo, commentaire, export PDF signable. Ta protection décennale en poche.",
              badge: "live" as const,
              label: "Disponible",
            },
            {
              n: "06",
              name: "Simulateur taux horaire",
              desc: "Salaire net voulu → charges → jours non facturables → taux minimum viable. La question que personne ne répond clairement.",
              badge: "soon" as const,
              label: "Bientôt",
            },
          ].map((tool) => (
            <div className="tool-card reveal" key={tool.n}>
              <div className="tool-num">{tool.n}</div>
              <div className="tool-name">{tool.name}</div>
              <div className="tool-desc">{tool.desc}</div>
              <div className={`tool-badge ${tool.badge}`}>{tool.label}</div>
            </div>
          ))}
        </div>
      </section>

      <hr className="divider" />

      {/* POUR QUI */}
      <section className="section" id="pour-qui">
        <div className="section-tag">Pour qui</div>
        <div className="target-grid">
          <div className="target-card reveal">
            <div className="target-label">Cible principale</div>
            <div className="target-title">L&apos;entrepreneur BTP qui démarre</div>
            <div className="target-desc">
              Tu viens de créer ta SASU ou ton EURL. Tu fais tout toi-même. Tu
              n&apos;as pas le budget pour un ERP à 200 €/mois.
            </div>
            <div className="target-list">
              <div className="target-list-item">
                Électricien, plaquiste, carreleur, peintre, maçon
              </div>
              <div className="target-list-item">0 à 3 ans d&apos;activité</div>
              <div className="target-list-item">1 à 3 personnes</div>
              <div className="target-list-item">
                Cherche à rester rentable sans se perdre dans les chiffres
              </div>
            </div>
          </div>

          <div className="target-card reveal">
            <div className="target-label">Cible secondaire</div>
            <div className="target-title">L&apos;investisseur immobilier actif</div>
            <div className="target-desc">
              Tu fais tout ou partie des travaux toi-même. Tu as besoin de
              chiffrer avant d&apos;acheter un bien, pas après.
            </div>
            <div className="target-list">
              <div className="target-list-item">Marchand de biens TPE</div>
              <div className="target-list-item">
                Investisseur locatif avec réno
              </div>
              <div className="target-list-item">
                Chiffrage = décision d&apos;acquisition
              </div>
              <div className="target-list-item">
                Besoin de précision, pas d&apos;approximation
              </div>
            </div>
          </div>
        </div>
      </section>

      <hr className="divider" />

      {/* PRICING */}
      <section className="section" id="tarifs">
        <div className="section-tag">Tarifs</div>
        <div className="pricing-grid">
          <div className="pricing-card">
            <div className="pricing-plan">Plan Démarrage</div>
            <div className="pricing-price">
              19<span style={{ fontSize: "1.5rem", fontWeight: 500 }}> €</span>
            </div>
            <div className="pricing-period">par mois · sans engagement</div>
            <ul className="pricing-features">
              <li>Chiffrage matériaux (5 chantiers/mois)</li>
              <li>Calculateur de rentabilité</li>
              <li>Bibliothèque DTU complète</li>
              <li>Checklist démarrage entrepreneur</li>
              <li>Support par email</li>
            </ul>
            <button className="pricing-btn outlined">
              Commencer gratuitement
            </button>
          </div>

          <div className="pricing-card featured">
            <div className="pricing-plan">Plan Pro</div>
            <div className="pricing-price" style={{ color: "var(--white)" }}>
              39<span style={{ fontSize: "1.5rem", fontWeight: 500 }}> €</span>
            </div>
            <div className="pricing-period">par mois · sans engagement</div>
            <ul className="pricing-features">
              <li>Tout le plan Démarrage</li>
              <li>Chiffrage illimité</li>
              <li>Générateur de devis PDF</li>
              <li>PV de réception chantier</li>
              <li>Simulateur taux horaire viable</li>
              <li>Situations de travaux</li>
            </ul>
            <button className="pricing-btn solid">
              Démarrer l&apos;essai gratuit
            </button>
          </div>
        </div>
        <div className="pricing-note">
          14 jours d&apos;essai gratuit · Aucune carte bancaire requise ·
          Résiliable à tout moment
        </div>
      </section>

      {/* CTA FINAL */}
      <div className="cta-section reveal">
        <div className="cta-title">
          Ton premier
          <br />
          chantier <em>rentable</em>
          <br />
          commence ici.
        </div>
        <div className="cta-right">
          <Link
            href="/dashboard"
            className="btn-primary"
            style={{
              background: "var(--green)",
              fontSize: "16px",
              padding: "16px 32px",
            }}
          >
            Accès bêta gratuit <span className="arrow">→</span>
          </Link>
          <div className="cta-note">
            Conçu par un artisan BTP · Pour les artisans BTP
          </div>
        </div>
      </div>

      {/* FOOTER */}
      <footer>
        <div className="footer-logo">
          SOCLE<span />
        </div>
        <div className="footer-meta">
          © 2026 · Fait en France · Pour les pros du BTP
        </div>
      </footer>
    </div>
  );
}

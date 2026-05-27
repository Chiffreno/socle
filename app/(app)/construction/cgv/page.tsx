"use client";

import { useMemo, useState } from "react";
import "./cgv.css";

// ── TYPES ──
type Fields = {
  nom: string;
  statut: string;
  siren: string;
  adresse: string;
  rm: string;
  naf: string;
  email: string;
  tel: string;
  assureur: string;
  police: string;
  zone: string;
  acompte: string;
  delai: string;
  tva: string;
  tauxh: string;
  mediateur: string;
  "resil-pct": string;
  "dechets-qui": string;
};

type Clients = {
  particuliers: boolean;
  professionnels: boolean;
};

type ToggleKey =
  | "suppl"
  | "force"
  | "client"
  | "vices"
  | "resil"
  | "sous"
  | "photos"
  | "index"
  | "dechets"
  | "securite";

type Toggles = Record<ToggleKey, boolean>;

// ── DEFAULTS ──
const DEFAULT_FIELDS: Fields = {
  nom: "",
  statut: "SASU",
  siren: "",
  adresse: "",
  rm: "",
  naf: "",
  email: "",
  tel: "",
  assureur: "",
  police: "",
  zone: "",
  acompte: "30",
  delai: "30 jours",
  tva: "10%",
  tauxh: "40",
  mediateur: "CM2C",
  "resil-pct": "20",
  "dechets-qui": "entreprise",
};

const DEFAULT_CLIENTS: Clients = { particuliers: true, professionnels: true };

const DEFAULT_TOGGLES: Toggles = {
  suppl: true,
  force: true,
  client: true,
  vices: true,
  resil: true,
  sous: false,
  photos: false,
  index: false,
  dechets: false,
  securite: true,
};

// ── GÉNÉRATION (port verbatim de gen()) ──
function generate(
  fields: Fields,
  clients: Clients,
  toggles: Toggles
): { html: string; artN: number } {
  let artN = 0;
  const art = (titre: string) => {
    artN++;
    return `<h2>Article ${artN} — ${titre}</h2>`;
  };

  const v = (id: keyof Fields) => (fields[id] ?? "").trim();
  const ph = (val: string, label: string) =>
    val ? val : `<span class="ph">[${label}]</span>`;
  const today = () =>
    new Date().toLocaleDateString("fr-FR", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });

  const nom = v("nom"),
    statut = v("statut"),
    siren = v("siren"),
    adresse = v("adresse");
  const rm = v("rm"),
    naf = v("naf"),
    email = v("email"),
    tel = v("tel");
  const assureur = v("assureur"),
    police = v("police"),
    zone = v("zone");
  const acompte = v("acompte"),
    delai = v("delai"),
    tva = v("tva");
  const tauxh = v("tauxh") || "40";
  const mediateur = v("mediateur");
  const resilPct = v("resil-pct") || "20";
  const dechetsQui = v("dechets-qui") || "entreprise";
  const avP = clients.particuliers,
    avB = clients.professionnels;

  const nomRef = ph(nom, "Raison sociale");
  const acompteStr =
    acompte === "0"
      ? "Aucun acompte n'est exigé à la commande."
      : `Un acompte de ${acompte}% du montant HT est exigible à la signature du devis, avant tout démarrage des travaux.`;
  const penalB = avB
    ? `Pour les clients professionnels, tout retard de paiement entraîne de plein droit, sans mise en demeure préalable : (i) des pénalités de retard au taux directeur de la BCE majoré de 10 points de pourcentage, courrant jusqu'au paiement intégral ; (ii) une indemnité forfaitaire pour frais de recouvrement de 40 € (art. D. 441-5 C. com.), sans préjudice de tout dommage complémentaire si les frais réels de recouvrement dépassent ce montant.`
    : "";
  const penalP = avP
    ? `Pour les clients particuliers, tout retard de paiement entraîne des intérêts de retard au taux légal en vigueur, exigibles à compter d'une mise en demeure restée sans effet pendant 8 jours.`
    : "";

  const html = `
    <div class="cgv-title">CONDITIONS GÉNÉRALES DE VENTE</div>
    <div class="cgv-subtitle">${nomRef} — ${statut}<br>Document établi le ${today()}</div>
    <div class="cgv-id">
      <strong>${nomRef}</strong> — ${statut}<br>
      SIREN : ${ph(siren, "SIREN")} &nbsp;|&nbsp; Code NAF : ${ph(naf, "Code NAF")}<br>
      RM : ${ph(rm, "N° Registre des Métiers")}<br>
      Siège : ${ph(adresse, "Adresse")}<br>
      ${email ? `Email : ${email}` : ""}${email && tel ? " &nbsp;|&nbsp; " : ""}${tel ? `Tél. : ${tel}` : ""}
    </div>

    ${art("Champ d'application")}
    <p>Les présentes Conditions Générales de Vente (CGV) régissent l'ensemble des relations contractuelles entre ${nomRef} (ci-après « l'Entreprise ») et ses clients${avP && avB ? ", particuliers ou professionnels," : avP ? " particuliers" : " professionnels"}, pour tout devis, commande ou contrat de travaux. Toute commande implique l'acceptation pleine et entière des présentes CGV, qui prévalent sur tout autre document du client sauf dérogation expresse et écrite.</p>

    ${art("Devis et formation du contrat")}
    <p>Tout devis est valable <strong>30 jours</strong> à compter de sa date d'émission. Le contrat est formé par la signature du devis accompagnée de la mention « Bon pour accord »${acompte !== "0" ? ` et du versement de l'acompte prévu à l'article concernant les conditions de paiement` : ""}. Toute modification ultérieure fait l'objet d'un avenant écrit signé par les deux parties, pouvant entraîner une révision du prix et/ou des délais.</p>

    ${art("Prix et TVA")}
    <p>Les prix sont exprimés en euros HT. La TVA applicable est de <strong>${tva}</strong> pour les travaux entrant dans le champ de l'article 279-0 bis du CGI. D'autres taux peuvent s'appliquer selon la nature précise des travaux (neuf : 20 %, isolation thermique : 5,5 %). En cas de modification légale des taux de TVA, les prix TTC seront ajustés en conséquence.</p>

    ${art("Délais d'exécution")}
    <p>Les délais d'exécution courent à compter de la réception de l'acompte et de toutes les informations nécessaires. Ils sont donnés à titre indicatif et ne constituent pas un engagement ferme sauf mention contraire écrite dans le devis. Les délais sont automatiquement prolongés en cas de modification demandée par le client, de défaillance d'un tiers ou d'événement de force majeure.</p>

    ${art("Conditions de paiement")}
    <p>${acompteStr}</p>
    <p>Le solde est exigible <strong>${delai}</strong>, déduction faite de l'acompte versé. Aucun escompte n'est accordé pour paiement anticipé sauf accord express préalable.</p>
    <p>${penalP}</p>
    ${penalB ? `<p>${penalB}</p>` : ""}

    ${art("Réserve de propriété")}
    <p>L'Entreprise conserve la propriété des matériaux et produits fournis jusqu'au paiement intégral du prix. Cette clause s'applique même en cas d'incorporation dans l'immeuble dans les conditions permises par la loi. En cas de non-paiement, l'Entreprise peut exiger la restitution des matériaux non encore incorporés.</p>

    ${art("Réception des travaux")}
    <p>À l'achèvement des travaux, une réception contradictoire est organisée, faisant l'objet d'un procès-verbal signé. En l'absence de réserve notifiée à l'Entreprise dans un délai de <strong>8 jours</strong> suivant l'achèvement, les travaux sont réputés acceptés sans réserve.</p>

    ${avP ? `
    ${art("Droit de rétractation (particuliers)")}
    <p>Conformément aux articles L. 221-18 et suivants du Code de la consommation, tout client particulier ayant conclu un contrat hors établissement dispose d'un <strong>droit de rétractation de 14 jours calendaires</strong> à compter de la signature, en adressant le formulaire joint ou toute déclaration non ambiguë par courrier recommandé avec accusé de réception.</p>
    <div class="hi">Si le client particulier demande expressément le commencement des travaux avant l'expiration de ce délai, il devra payer un montant proportionnel aux prestations fournies jusqu'à la communication de sa rétractation (art. L. 221-25 C. conso.).</div>
    ` : ""}

    ${art("Garanties légales")}
    <ul>
      <li><strong>Parfait achèvement (art. 1792-6 C. civ.) :</strong> 1 an à compter de la réception — tous les désordres signalés.</li>
      <li><strong>Bon fonctionnement (art. 1792-3 C. civ.) :</strong> 2 ans — éléments d'équipement dissociables.</li>
      <li><strong>Décennale (art. 1792 C. civ.) :</strong> 10 ans — dommages compromettant la solidité ou l'usage.</li>
    </ul>
    <div class="hi"><strong>Assurance décennale :</strong> ${ph(assureur, "Assureur")} — Police N° ${ph(police, "N° Police")} — Zone : ${ph(zone, "Zone géographique")}</div>

    ${toggles.vices ? `
    ${art("Vices cachés préexistants")}
    <p>L'Entreprise n'est pas responsable des vices cachés préexistants à son intervention (présence d'amiante, installations électriques non conformes, structures défectueuses, pollution des sols, etc.). Toute découverte en cours de chantier d'un désordre préexistant entraîne l'arrêt immédiat des travaux concernés et la rédaction d'un avenant définissant les nouvelles conditions d'exécution et de prix. Les travaux ne reprennent qu'après signature de cet avenant par les deux parties.</p>
    ` : ""}

    ${toggles.suppl ? `
    ${art("Travaux supplémentaires et modificatifs")}
    <p>Tout travail non expressément prévu au devis initial constitue un travail supplémentaire. <strong>Aucun travail supplémentaire ne peut être exécuté sans avoir fait l'objet d'un avenant écrit et signé par les deux parties préalablement à son exécution.</strong> Les travaux supplémentaires réalisés en urgence, avec accord verbal du client attesté par un bon de commande ou un email, seront facturés au taux horaire de <strong>${tauxh} € HT/h</strong> majoré des coûts de matériaux. Les travaux supplémentaires effectués sans avenant ni accord exprès ne sont pas dus par le client mais peuvent faire l'objet d'une demande de paiement fondée sur l'enrichissement sans cause.</p>
    ` : ""}

    ${toggles.client ? `
    ${art("Obligations du maître d'ouvrage")}
    <p>Le client s'engage à : (i) fournir un accès libre et sécurisé au chantier aux horaires convenus, (ii) mettre à disposition l'alimentation en eau et en électricité nécessaire à l'exécution des travaux, (iii) fournir tous plans, documents techniques et autorisations administratives nécessaires avant le démarrage, (iv) dégager les zones d'intervention des meubles et effets personnels. Le non-respect de l'une de ces obligations entraîne la suspension automatique des délais d'exécution et peut donner lieu à une facturation des temps d'attente au taux horaire de ${tauxh} € HT/h.</p>
    ` : ""}

    ${toggles.securite ? `
    ${art("Sécurité et conditions d'intervention")}
    <p>L'Entreprise se réserve le droit d'interrompre les travaux sans préavis et sans pénalité si les conditions d'hygiène, de sécurité ou d'accès au chantier ne permettent pas une exécution dans des conditions conformes à la réglementation applicable (Code du travail — santé et sécurité au travail). L'Entreprise n'est pas responsable des dommages causés par des tiers ayant accès au chantier en dehors de ses heures de présence, sauf manquement à son obligation de sécurisation du chantier.</p>
    ` : ""}

    ${toggles.force ? `
    ${art("Force majeure")}
    <p>Constituent des cas de force majeure libérant l'Entreprise de ses obligations de délai, sans indemnité, les événements présentant les caractères d'extériorité, d'imprévisibilité et d'irrésistibilité, notamment : intempéries classées par Météo-France rendant l'exécution des travaux dangereuse ou impossible, grèves de fournisseurs ou transporteurs, pénurie de matériaux indépendante de la volonté de l'Entreprise, épidémie ou pandémie reconnue par les autorités, coupures prolongées d'énergie, désordres affectant les approvisionnements, inondations, séismes. L'Entreprise informe le client dans les meilleurs délais de la survenance d'un tel événement et des conséquences sur le calendrier.</p>
    ` : ""}

    ${toggles.resil ? `
    ${art("Résiliation du contrat")}
    <p>En cas de résiliation du contrat à l'initiative du client après signature du devis et avant démarrage des travaux, une indemnité forfaitaire de <strong>${resilPct}% du montant HT</strong> est due à l'Entreprise, couvrant les frais de mobilisation et les commandes de matériaux déjà passées. Les matériaux spécifiquement commandés pour le chantier restent à la charge du client sur présentation des justificatifs d'achat. En cas de résiliation en cours de travaux, les prestations réalisées sont facturées au prorata de l'avancement, majorées des coûts liés à l'interruption et à la remise en état du chantier.</p>
    ` : ""}

    ${toggles.index ? `
    ${art("Révision des prix — Clause d'indexation BT01")}
    <p>Pour les chantiers dont la durée d'exécution est supérieure à 3 mois, les prix pourront être révisés à la hausse ou à la baisse en fonction de l'évolution de l'indice BT01 (indice général du bâtiment, publié mensuellement par l'INSEE). La formule de révision est : P = Po × (BT / BTo), où Po est le prix initial, BTo est la valeur de l'indice BT01 au mois de signature du devis, et BT est la valeur de l'indice au mois d'exécution des travaux concernés. L'Entreprise informera le client de toute révision significative (supérieure à 3%) avant son application.</p>
    ` : ""}

    ${toggles.sous ? `
    ${art("Recours à la sous-traitance")}
    <p>L'Entreprise se réserve le droit de sous-traiter tout ou partie des travaux à des entreprises spécialisées qualifiées et couvertes par les assurances professionnelles requises. Le recours à la sous-traitance ne modifie pas la responsabilité de l'Entreprise vis-à-vis du client. Le client est informé du recours à la sous-traitance et conserve son droit de recours direct contre le sous-traitant dans les conditions prévues par la loi N° 75-1334 du 31 décembre 1975.</p>
    ` : ""}

    ${toggles.dechets ? `
    ${art("Déchets, gravats et nettoyage de chantier")}
    <p>${dechetsQui === "entreprise" ? `L'évacuation des déchets, gravats et emballages produits par les travaux est incluse dans le prix du devis. L'Entreprise assure le tri sélectif selon la réglementation en vigueur et l'évacuation vers une déchetterie agréée. Un nettoyage de base de la zone d'intervention est effectué à l'achèvement des travaux.` : dechetsQui === "client" ? `L'évacuation des déchets, gravats et emballages produits par les travaux est à la charge exclusive du maître d'ouvrage, sauf mention contraire au devis. L'Entreprise peut, sur demande, assurer cette prestation avec un devis complémentaire spécifique.` : `Les conditions d'évacuation des déchets et de nettoyage de fin de chantier sont précisées dans chaque devis. En l'absence de mention expresse, l'évacuation reste à la charge du maître d'ouvrage.`}</p>
    ` : ""}

    ${toggles.photos ? `
    ${art("Photographies et références commerciales")}
    <p>L’Entreprise se réserve le droit de photographier les travaux avant, pendant et après leur réalisation à des fins de documentation technique et de promotion commerciale (site internet, réseaux professionnels, book de références). ${avP ? "Pour les clients particuliers, ces photographies ne permettront pas l’identification du logement ou des occupants sans accord exprès écrit. Le client particulier peut s’opposer à toute utilisation commerciale des photographies en le notifiant lors de la signature du devis." : "Ces photographies pourront être utilisées à des fins de références commerciales, sous réserve de ne pas divulguer d’informations confidentielles relatives à l’activité du client professionnel."}</p>
    ` : ""}

    ${art("Responsabilité")}
    <p>La responsabilité de l'Entreprise ne peut être engagée qu'en cas de faute prouvée et est limitée au montant du devis accepté, sauf faute lourde ou dolosive. L'Entreprise n'est pas responsable des dommages indirects ou immatériels.</p>

    ${art("Données personnelles (RGPD)")}
    <p>Les données collectées sont traitées conformément au RGPD (UE 2016/679) et conservées pour la durée légale (10 ans pour les documents comptables). Droits d'accès, rectification et effacement : ${ph(email, "email de contact")}.</p>

    ${avP ? `
    ${art("Médiation de la consommation")}
    <p>Conformément aux articles L. 616-1 et R. 616-1 du Code de la consommation, en cas de litige non résolu à l'amiable, le client particulier peut recourir gratuitement à : <strong>${mediateur}</strong>. Ce recours est facultatif et n'empêche pas de saisir les juridictions compétentes.</p>
    ` : ""}

    ${avB ? `
    ${art("Clauses spécifiques aux clients professionnels")}
    <p><strong>Attribution de juridiction :</strong> En cas de litige entre professionnels, compétence exclusive aux tribunaux du ressort du siège social de l'Entreprise. <strong>Délais de paiement :</strong> Conformément à l'art. L. 441-10 C. com., délai maximum de 60 jours nets ou 45 jours fin de mois. <strong>Compensation :</strong> Toute compensation entre créances doit faire l'objet d'un accord express écrit préalable.</p>
    ` : ""}

    ${art("Droit applicable")}
    <p>Les présentes CGV sont soumises au droit français. ${avP ? "Pour les clients particuliers, les juridictions compétentes sont celles du domicile du défendeur." : "Attribution expresse de juridiction au tribunal compétent du siège social de l'Entreprise."}</p>

    <div class="cgv-footer">
      CGV générées via SOCLE · ${ph(nom, "Raison sociale")} · SIREN : ${ph(siren, "SIREN")} · ${today()}<br>
      <em>Ce document est un modèle indicatif — faire valider par un professionnel du droit avant utilisation commerciale.</em>
    </div>
  `;

  return { html, artN };
}

export default function CgvPage() {
  const [fields, setFields] = useState<Fields>(DEFAULT_FIELDS);
  const [clients, setClients] = useState<Clients>(DEFAULT_CLIENTS);
  const [toggles, setToggles] = useState<Toggles>(DEFAULT_TOGGLES);

  const { html: generated, artN } = useMemo(
    () => generate(fields, clients, toggles),
    [fields, clients, toggles]
  );

  const setField =
    (key: keyof Fields) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setFields((f) => ({ ...f, [key]: e.target.value }));

  const toggleClient = (t: keyof Clients) =>
    setClients((c) => ({ ...c, [t]: !c[t] }));

  const toggle = (key: ToggleKey) =>
    setToggles((t) => ({ ...t, [key]: !t[key] }));

  return (
    <div className="cgv-tool">
      <main className="main">
        <div className="page-eyebrow">Terrain · Documents juridiques</div>
        <h1 className="page-title">Générateur de CGV BTP</h1>
        <p className="page-sub">
          Conditions Générales de Vente adaptées à ton activité. Toutes les
          clauses obligatoires plus les clauses spécifiques BTP les plus
          litigieuses.
        </p>

        <div className="disclaimer">
          <strong>Document indicatif.</strong> Ces CGV couvrent les mentions
          légalement obligatoires et les clauses les plus fréquentes en BTP.
          Faire relire par un professionnel du droit avant utilisation
          commerciale. SOCLE ne constitue pas un conseil juridique.
        </div>

        <div className="sim-grid">
          {/* ═══ FORMULAIRE ═══ */}
          <div className="form-col">
            {/* Identité */}
            <div className="card">
              <div className="card-title">
                <i className="ti ti-building" aria-hidden="true"></i>Identité de
                l&apos;entreprise
              </div>
              <div className="card-sub">
                Ces informations apparaissent en en-tête et sont obligatoires
                sur tous tes documents commerciaux.
              </div>
              <div className="field">
                <div className="field-label">
                  Raison sociale / Nom commercial
                </div>
                <input
                  className="field-input"
                  type="text"
                  placeholder="GOMES Benjamin — Électricité"
                  value={fields.nom}
                  onChange={setField("nom")}
                />
              </div>
              <div className="field-row">
                <div className="field">
                  <div className="field-label">Statut juridique</div>
                  <select
                    className="field-input field-select"
                    value={fields.statut}
                    onChange={setField("statut")}
                  >
                    <option value="SASU">SASU</option>
                    <option value="EURL">EURL</option>
                    <option value="Micro-entreprise">Micro-entreprise</option>
                    <option value="SAS">SAS</option>
                    <option value="SARL">SARL</option>
                  </select>
                </div>
                <div className="field">
                  <div className="field-label">SIREN</div>
                  <input
                    className="field-input"
                    type="text"
                    placeholder="123 456 789"
                    value={fields.siren}
                    onChange={setField("siren")}
                  />
                </div>
              </div>
              <div className="field">
                <div className="field-label">Adresse du siège social</div>
                <input
                  className="field-input"
                  type="text"
                  placeholder="12 rue des Artisans, 77260 Changis-sur-Marne"
                  value={fields.adresse}
                  onChange={setField("adresse")}
                />
              </div>
              <div className="field-row">
                <div className="field">
                  <div className="field-label">
                    N° inscription RM{" "}
                    <span className="opt">(Chambre des Métiers)</span>
                  </div>
                  <input
                    className="field-input"
                    type="text"
                    placeholder="123456789 77"
                    value={fields.rm}
                    onChange={setField("rm")}
                  />
                </div>
                <div className="field">
                  <div className="field-label">Code NAF</div>
                  <input
                    className="field-input"
                    type="text"
                    placeholder="4321A"
                    value={fields.naf}
                    onChange={setField("naf")}
                  />
                </div>
              </div>
              <div className="field-row">
                <div className="field">
                  <div className="field-label">Email</div>
                  <input
                    className="field-input"
                    type="email"
                    placeholder="contact@entreprise.fr"
                    value={fields.email}
                    onChange={setField("email")}
                  />
                </div>
                <div className="field">
                  <div className="field-label">Téléphone</div>
                  <input
                    className="field-input"
                    type="text"
                    placeholder="06 00 00 00 00"
                    value={fields.tel}
                    onChange={setField("tel")}
                  />
                </div>
              </div>
            </div>

            {/* Assurance */}
            <div className="card">
              <div className="card-title">
                <i className="ti ti-shield" aria-hidden="true"></i>Assurances
                professionnelles
              </div>
              <div className="card-sub">
                La mention de la décennale est obligatoire sur tous tes
                documents commerciaux en BTP.
              </div>
              <div className="field">
                <div className="field-label">
                  Assureur (garantie décennale)
                </div>
                <input
                  className="field-input"
                  type="text"
                  placeholder="Hiscox / April / MMA..."
                  value={fields.assureur}
                  onChange={setField("assureur")}
                />
              </div>
              <div className="field-row">
                <div className="field">
                  <div className="field-label">N° de police décennale</div>
                  <input
                    className="field-input"
                    type="text"
                    placeholder="GD-2024-123456"
                    value={fields.police}
                    onChange={setField("police")}
                  />
                </div>
                <div className="field">
                  <div className="field-label">Zone géographique</div>
                  <input
                    className="field-input"
                    type="text"
                    placeholder="France métropolitaine"
                    value={fields.zone}
                    onChange={setField("zone")}
                  />
                </div>
              </div>
            </div>

            {/* Conditions commerciales */}
            <div className="card">
              <div className="card-title">
                <i className="ti ti-coin" aria-hidden="true"></i>Conditions
                commerciales
              </div>
              <div className="card-sub">
                Ces paramètres définissent tes conditions de paiement et les
                pénalités applicables.
              </div>
              <div className="field-row">
                <div className="field">
                  <div className="field-label">Acompte à la signature</div>
                  <select
                    className="field-input field-select"
                    value={fields.acompte}
                    onChange={setField("acompte")}
                  >
                    <option value="0">Pas d&apos;acompte</option>
                    <option value="30">30% du montant HT</option>
                    <option value="40">40% du montant HT</option>
                    <option value="50">50% du montant HT</option>
                  </select>
                </div>
                <div className="field">
                  <div className="field-label">Délai de paiement solde</div>
                  <select
                    className="field-input field-select"
                    value={fields.delai}
                    onChange={setField("delai")}
                  >
                    <option value="réception">À réception de facture</option>
                    <option value="15 jours">15 jours</option>
                    <option value="30 jours">30 jours</option>
                    <option value="45 jours">45 jours</option>
                  </select>
                </div>
              </div>
              <div className="field-row">
                <div className="field">
                  <div className="field-label">TVA principale</div>
                  <select
                    className="field-input field-select"
                    value={fields.tva}
                    onChange={setField("tva")}
                  >
                    <option value="5,5%">5,5% — Isolation/énergie</option>
                    <option value="10%">10% — Rénovation particuliers</option>
                    <option value="20%">20% — Neuf / professionnels</option>
                  </select>
                </div>
                <div className="field">
                  <div className="field-label">Taux horaire de référence</div>
                  <input
                    className="field-input"
                    type="number"
                    min="10"
                    max="300"
                    value={fields.tauxh}
                    onChange={setField("tauxh")}
                  />
                </div>
              </div>
              <div
                style={{
                  fontSize: "12px",
                  color: "var(--gray3)",
                  marginTop: "-8px",
                }}
              >
                Le taux horaire s&apos;applique à la facturation des travaux
                supplémentaires non prévus au devis.
              </div>
            </div>

            {/* Type de clients */}
            <div className="card">
              <div className="card-title">
                <i className="ti ti-users" aria-hidden="true"></i>Type de
                clients
              </div>
              <div className="card-sub">
                Détermine les clauses légales à inclure. Les obligations
                diffèrent fortement entre particuliers (Code consommation) et
                professionnels (Code de commerce).
              </div>
              <div className="client-pills">
                <div
                  className={`cpill${clients.particuliers ? " active" : ""}`}
                  onClick={() => toggleClient("particuliers")}
                >
                  <i className="ti ti-home" aria-hidden="true"></i>Particuliers
                </div>
                <div
                  className={`cpill${clients.professionnels ? " active" : ""}`}
                  onClick={() => toggleClient("professionnels")}
                >
                  <i className="ti ti-briefcase" aria-hidden="true"></i>
                  Professionnels
                </div>
              </div>
            </div>

            {/* Clauses optionnelles */}
            <div className="card">
              <div className="card-title">
                <i className="ti ti-adjustments" aria-hidden="true"></i>Clauses
                spécifiques BTP
              </div>
              <div className="card-sub">
                Active les clauses adaptées à ton activité. Chacune couvre une
                situation courante source de litige.
              </div>

              <div className="toggles-grid">
                <div
                  className={`toggle-row${toggles.suppl ? " on" : ""}`}
                  onClick={() => toggle("suppl")}
                >
                  <div className="toggle-check">
                    <i className="ti ti-check" aria-hidden="true"></i>
                  </div>
                  <div className="toggle-info">
                    <div className="toggle-name">Travaux supplémentaires</div>
                    <div className="toggle-desc">
                      Encadre les demandes en cours de chantier. Source de
                      litige N°1 en BTP. Avenant écrit obligatoire avant
                      exécution.
                    </div>
                  </div>
                </div>

                <div
                  className={`toggle-row${toggles.force ? " on" : ""}`}
                  onClick={() => toggle("force")}
                >
                  <div className="toggle-check">
                    <i className="ti ti-check" aria-hidden="true"></i>
                  </div>
                  <div className="toggle-info">
                    <div className="toggle-name">Force majeure</div>
                    <div className="toggle-desc">
                      Liste explicite des événements reconnus en BTP :
                      intempéries, grève fournisseurs, pénurie matériaux,
                      épidémie.
                    </div>
                  </div>
                </div>

                <div
                  className={`toggle-row${toggles.client ? " on" : ""}`}
                  onClick={() => toggle("client")}
                >
                  <div className="toggle-check">
                    <i className="ti ti-check" aria-hidden="true"></i>
                  </div>
                  <div className="toggle-info">
                    <div className="toggle-name">
                      Obligations du maître d&apos;ouvrage
                    </div>
                    <div className="toggle-desc">
                      Accès chantier, alimentation eau/électricité, fourniture
                      des plans. Si le client ne respecte pas ses obligations,
                      les délais sont suspendus.
                    </div>
                  </div>
                </div>

                <div
                  className={`toggle-row${toggles.vices ? " on" : ""}`}
                  onClick={() => toggle("vices")}
                >
                  <div className="toggle-check">
                    <i className="ti ti-check" aria-hidden="true"></i>
                  </div>
                  <div className="toggle-info">
                    <div className="toggle-name">Vices cachés préexistants</div>
                    <div className="toggle-desc">
                      Dégage ta responsabilité sur les désordres antérieurs
                      (amiante, installation non conforme, structure
                      défectueuse). Procédure arrêt de travaux + avenant.
                    </div>
                  </div>
                </div>

                <div
                  className={`toggle-row${toggles.resil ? " on" : ""}`}
                  onClick={() => toggle("resil")}
                >
                  <div className="toggle-check">
                    <i className="ti ti-check" aria-hidden="true"></i>
                  </div>
                  <div className="toggle-info">
                    <div className="toggle-name">Résiliation du contrat</div>
                    <div className="toggle-desc">
                      Cadre l&apos;annulation par le client avant ou pendant les
                      travaux. Indemnisation des matériaux commandés et de la
                      mobilisation.
                    </div>
                    <div
                      className={`sub-field${toggles.resil ? " visible" : ""}`}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div
                        className="field-label"
                        style={{ fontSize: "12px", marginBottom: "6px" }}
                      >
                        Indemnisation forfaitaire si résiliation avant démarrage
                      </div>
                      <select
                        className="field-input field-select"
                        style={{ fontSize: "13px" }}
                        value={fields["resil-pct"]}
                        onChange={setField("resil-pct")}
                      >
                        <option value="15">15% du montant HT</option>
                        <option value="20">20% du montant HT</option>
                        <option value="30">30% du montant HT</option>
                      </select>
                    </div>
                  </div>
                </div>

                <div
                  className={`toggle-row${toggles.sous ? " on" : ""}`}
                  onClick={() => toggle("sous")}
                >
                  <div className="toggle-check">
                    <i className="ti ti-check" aria-hidden="true"></i>
                  </div>
                  <div className="toggle-info">
                    <div className="toggle-name">Recours à la sous-traitance</div>
                    <div className="toggle-desc">
                      Déclare que tu peux faire appel à des sous-traitants
                      qualifiés et assurés, sans modifier ta responsabilité
                      vis-à-vis du client.
                    </div>
                  </div>
                </div>

                <div
                  className={`toggle-row${toggles.photos ? " on" : ""}`}
                  onClick={() => toggle("photos")}
                >
                  <div className="toggle-check">
                    <i className="ti ti-check" aria-hidden="true"></i>
                  </div>
                  <div className="toggle-info">
                    <div className="toggle-name">
                      Photos et références commerciales
                    </div>
                    <div className="toggle-desc">
                      Autorisation de photographier le chantier pour ton book et
                      tes réseaux, sous réserve d&apos;accord du client pour les
                      particuliers.
                    </div>
                  </div>
                </div>

                <div
                  className={`toggle-row${toggles.index ? " on" : ""}`}
                  onClick={() => toggle("index")}
                >
                  <div className="toggle-check">
                    <i className="ti ti-check" aria-hidden="true"></i>
                  </div>
                  <div className="toggle-info">
                    <div className="toggle-name">
                      Révision des prix — indice BT01
                    </div>
                    <div className="toggle-desc">
                      Pour les chantiers de plus de 3 mois. Indexation sur
                      l&apos;indice BT01 (INSEE) en cas de variation
                      significative du coût des matériaux.
                    </div>
                  </div>
                </div>

                <div
                  className={`toggle-row${toggles.dechets ? " on" : ""}`}
                  onClick={() => toggle("dechets")}
                >
                  <div className="toggle-check">
                    <i className="ti ti-check" aria-hidden="true"></i>
                  </div>
                  <div className="toggle-info">
                    <div className="toggle-name">
                      Déchets et nettoyage de fin de chantier
                    </div>
                    <div className="toggle-desc">
                      Définit qui évacue les gravats et fait le nettoyage final.
                      Évite les conflits à la réception.
                    </div>
                    <div
                      className={`sub-field${toggles.dechets ? " visible" : ""}`}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div
                        className="field-label"
                        style={{ fontSize: "12px", marginBottom: "6px" }}
                      >
                        Évacuation des déchets
                      </div>
                      <select
                        className="field-input field-select"
                        style={{ fontSize: "13px" }}
                        value={fields["dechets-qui"]}
                        onChange={setField("dechets-qui")}
                      >
                        <option value="entreprise">
                          Incluse dans le prix — assurée par l&apos;entreprise
                        </option>
                        <option value="client">
                          À la charge du maître d&apos;ouvrage
                        </option>
                        <option value="devis">
                          Selon devis — précisé sur chaque devis
                        </option>
                      </select>
                    </div>
                  </div>
                </div>

                <div
                  className={`toggle-row${toggles.securite ? " on" : ""}`}
                  onClick={() => toggle("securite")}
                >
                  <div className="toggle-check">
                    <i className="ti ti-check" aria-hidden="true"></i>
                  </div>
                  <div className="toggle-info">
                    <div className="toggle-name">
                      Sécurité et conditions d&apos;accès
                    </div>
                    <div className="toggle-desc">
                      L&apos;entreprise peut interrompre les travaux en cas de
                      risque pour la sécurité. Non-responsabilité pour dommages
                      causés par des tiers hors présence.
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Médiation */}
            <div className="card">
              <div className="card-title">
                <i className="ti ti-scale" aria-hidden="true"></i>Médiation{" "}
                <span
                  style={{
                    fontSize: ".8rem",
                    fontWeight: 400,
                    color: "var(--gray3)",
                  }}
                >
                  — Obligatoire pour les particuliers
                </span>
              </div>
              <div className="card-sub">
                Depuis le 1er janvier 2016, tout professionnel traitant avec des
                particuliers doit proposer un médiateur de la consommation
                agréé.
              </div>
              <div className="field">
                <div className="field-label">
                  Médiateur de la consommation
                </div>
                <select
                  className="field-input field-select"
                  value={fields.mediateur}
                  onChange={setField("mediateur")}
                >
                  <option value="CM2C">
                    CM2C (Centre de Médiation et d&apos;Arbitrage de Paris) —
                    www.cm2c.net
                  </option>
                  <option value="MEDICYS">MEDICYS — www.medicys.fr</option>
                  <option value="La Médiation Professionnelle">
                    La Médiation Professionnelle —
                    www.lamediationprofessionnelle.org
                  </option>
                  <option value="CNPM">
                    CNPM Médiation de la Consommation —
                    www.cnpm-mediation-consommation.eu
                  </option>
                </select>
              </div>
            </div>
          </div>

          {/* ═══ APERÇU ═══ */}
          <div className="preview-col">
            <div className="preview-header">
              <div>
                <div className="preview-label">Aperçu CGV</div>
                <div className="preview-meta">{artN} articles</div>
              </div>
              <button
                className="btn-print"
                onClick={() => window.print()}
                type="button"
              >
                <i className="ti ti-download" aria-hidden="true"></i>
                Télécharger PDF
              </button>
            </div>
            <div className="preview-card">
              <div
                className="cgv-doc"
                dangerouslySetInnerHTML={{ __html: generated }}
              />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

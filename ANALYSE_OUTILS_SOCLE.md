# Analyse complète du projet SOCLE

*Document généré le 6 juin 2026 — état des lieux des outils, de l'architecture et de la migration.*

---

## 1. Vision d'ensemble

**SOCLE** est une suite d'outils web destinée aux **entrepreneurs du BTP qui démarrent** (0–3 ans, 1 à 3 personnes : électriciens, plaquistes, carreleurs, peintres, maçons) et, en cible secondaire, aux **investisseurs immobiliers actifs** qui chiffrent leurs travaux avant d'acheter.

La promesse, telle qu'exprimée par la landing page : *« Pilotez votre activité — chiffrage matériaux, marge chantier, devis client, réception terrain, sans usine à gaz »*. Le produit est positionné comme une alternative légère et terrain aux ERP BTP à 200 €/mois, avec deux offres : **Démarrage à 19 €/mois** et **Pro à 39 €/mois**.

Le projet couvre tout le cycle de vie de l'artisan : **lancement de l'entreprise → construction des prix → devis/facturation → fin de chantier (réception, DTU)**. C'est la logique des 4 blocs que l'on retrouve dans le dashboard.

> Héritage : plusieurs fichiers portent encore le nom **« ChiffReno »** (l'ancien nom du projet, centré sur le chiffrage de rénovation). SOCLE est la marque élargie qui englobe ChiffReno.

---

## 2. État du dépôt

Le dossier `SOCLE/SOCLE` mélange aujourd'hui **trois couches** :

| Couche | Contenu | État |
|---|---|---|
| **Production actuelle** | `estimateur_btp_v8_64.html`, `estimateur_btp_v8_65_1.html` | Outils HTML autonomes, fonctionnels, à la racine |
| **Prototypes** | dossier `_legacy/` (10 fichiers HTML) | Maquettes/POC des autres outils de la suite |
| **Migration cible** | scaffold **Next.js 15 / React 19 / TypeScript** (`package.json`, `tsconfig.json`, `next.config.ts`, `node_modules`) | **Non démarrée** — aucun dossier `app/` ni `src/`, aucune page |

**Point d'attention immédiat** : la migration Next.js est seulement *amorcée au niveau config*. Tout le produit vit encore sous forme de fichiers HTML mono-fichier (HTML + CSS + JS embarqués, sans framework, sans build). C'est le grand chantier technique à venir.

**Doublons de versions** : deux estimateurs coexistent à la racine (`v8_64` et `v8_65_1`, la plus récente) et une troisième copie plus ancienne dort dans `_legacy/chiffrage matériaux.html`. À rationaliser pour éviter la confusion sur « la » version de référence.

---

## 3. Les outils, un par un

### 🟢 Tier 1 — Outils matures (à la racine)

#### Estimateur BTP / Chiffrage matériaux — `estimateur_btp_v8_65_1.html`
**Rôle** : estimer le coût de fournitures (HT) d'un projet de rénovation, lot par lot, sur 15 corps d'état.
C'est l'outil le plus abouti et le plus complexe du projet (~1300 lignes), avec un vrai moteur de prix.

**Logique métier clé** :
- `BP` : dictionnaire plat de tous les prix matériaux unitaires (la source de vérité des prix).
- `calcItems(lid)` : moteur de chiffrage, un gros `switch` par lot qui produit les lignes `{qté, libellé, unité, prix, total}`.
- Surface globale ou par lot, **3 niveaux de qualité** (Éco / Standard / Premium via presets `QP`), **marge %** par lot, **TVA** (0/10/20).
- **Override de prix** inline (`cp`) avec badge « modifié » et reset, **coefficient global** (`globalCoeff`), **lignes personnalisées**, calcul de ragréage scalé à l'épaisseur (`pxRag`).
- **Exports** : CSV (résumé), **PDF** (document complet imprimable), et **liste d'achat** (« shopping list » avec conditionnement/packs par matériau).
- Persistance `localStorage` (clé `btp_v8d`).

**Maturité** : production. C'est le cœur de la valeur SOCLE. Versions multiples = itération active.

---

### 🟡 Tier 2 — Prototypes fonctionnels (`_legacy/`)

#### Simulateur de taux horaire — `socle_taux_horaire_v5_1.html`
**Rôle** : « Ce que tu dois facturer à l'heure pour couvrir toutes tes charges et te verser le salaire que tu veux. » La base de tous les devis.
**Logique** : salaire net visé → statut (micro / EI / SASU, taux de charges différents) → congés + jours non facturables/mois → heures réellement facturables/an → **taux horaire minimum viable**. Alertes si trop peu d'heures facturables ou taux trop élevé pour le marché. Détail des cotisations affiché.
**Maturité** : POC avancé et bien modélisé (state JS, sliders, détail). Marqué « Bientôt » sur la landing.

#### Prévisionnel première année — `socle_previsionnel_1.html`
**Rôle** : « Combien tu vas réellement gagner selon ton activité prévue », adapté au statut juridique.
**Logique** : modélise correctement **cotisations sociales, régime TVA et fiscalité** selon statut (micro / EI / EURL / SASU). Gère la **franchise en base de TVA** (seuil ~37 500 € en prestations de service micro → matériaux achetés en TTC non récupérable), les taux **5,5 % / 10 % / 20 %**, le calcul du CA nécessaire pour atteindre un salaire cible. Fonctions dédiées : `calculCotisations`, `calculCANecessaire`, `calculTVA`.
**Maturité** : POC solide, calculs fiscaux non triviaux.

#### Rentabilité chantier — `rentabilité chantier.html` *(ex-ChiffReno)*
**Rôle** : transformer un déboursé en prix de vente. **Déboursé sec → frais généraux → marge → prix de vente** (méthode Batiprix adaptée terrain).
**Logique** : coefficient de frais généraux calculé (`calcFG` à partir de charges/CA), mode de saisie multiple (`setMode`), métriques de marge et **verdict** (barre + message). 
**Maturité** : POC fonctionnel. Recoupe partiellement la logique de l'estimateur (prix) et du taux horaire (coût) — **à articuler** dans la version unifiée.

#### Simulateur de décennale — `socle_decennale.html`
**Rôle** : estimer le coût annuel d'assurance décennale selon CA prévisionnel, activités et profil. Tarifs calés sur **barèmes marché 2025-2026** des assureurs spécialisés BTP.
**Logique** : sélection de lots/activités (avec lot « principal »), statut (micro / EI-EURL / SASU-SARL-SAS), ancienneté, expérience → `calculerPrime()` + **coefficient multi-lots** (`coefMultiLots`). Affiche résultat, **scénarios** comparatifs et **recommandation**.
**Maturité** : POC abouti. Outil différenciant (sujet anxiogène et opaque pour l'artisan).

#### PV de réception chantier — `pv_reception_chantier.html` *(ex-ChiffReno)*
**Rôle** : procès-verbal de réception conforme. Par point de contrôle : **Conforme / Réserve / Refus**, photo, commentaire, export PDF signable. « Ta protection décennale en poche. »
**Logique** : app multi-écrans (`goTo`), sélection chantier/lots, génération de la grille de points (`renderPV`), états par point (`setState`), gestion photo (`handlePhoto`), suivi de progression, **génération PDF** (`generatePV`).
**Design** : seul outil en **thème sombre + layout mobile (max-width 480px)** — pensé terrain/smartphone. À harmoniser avec la charte claire des autres.
**Maturité** : POC fonctionnel orienté mobile.

#### Générateur de CGV BTP — `socle_cgv_2.html`
**Rôle** : générer des Conditions Générales de Vente conformes (mentions légales BTP).
**Logique** : formulaire entreprise/client (B2C/B2B via `toggleClient`), sections activables (`toggle`), génération article par article (`gen` + `art` qui numérote), placeholders pour champs manquants.
**Maturité** : générateur de document fonctionnel.

#### Checklist de lancement — `checklist.html`
**Rôle** : guider la création de l'entreprise BTP, en phases (avant immatriculation → après → avant premier chantier). C'est le « Bloc 01 · Lancement » du dashboard.
**Logique** : étapes cochables persistées (`loadState`/`saveState`), progression, **suivi de budget** (`updateBudget`/`renderBudget`), et un **questionnaire de recommandation** (modale, `checkRecommendation`/`showRecommendation`) — probablement pour orienter sur le statut juridique.
**Maturité** : POC fonctionnel avec persistance.

---

### 🔵 Tier 3 — Coquilles d'interface (`_legacy/`)

#### Landing page — `socle_landing_1.html`
Page marketing complète : hero, douleurs (5 points), grille des 6 outils (avec badges *Disponible* / *Bientôt*), cibles, pricing (19 €/39 €), CTA, footer. Animations au scroll. **Statique** (aucune logique applicative). Sert de référence pour le **positionnement et le périmètre produit**.

#### Dashboard — `socle_dashboard_v2.html`
Coquille de l'app connectée : topbar, sidebar de navigation (regroupée en *Construction / Chantier / Après*), métriques (marge moyenne, chantiers, devis, CA), bloc lancement rétractable, 3 blocs principaux, liste de chantiers récents, nav mobile. **Données en dur, pas de back** — c'est la maquette de la coque qui devra agréger tous les outils.

---

## 4. Lecture transversale

**Cohérence design** : la majorité des outils partagent une **charte commune** — couleurs (noir `#0a0a09`, vert `#1a7a3c`, fonds crème), polices **Figtree** + **DM Mono**, icônes **Tabler**. Deux exceptions à harmoniser : la *rentabilité chantier* (Segoe UI, palette légèrement différente, ex-ChiffReno) et le *PV de réception* (thème sombre mobile).

**Architecture actuelle** : chaque outil est un **HTML mono-fichier autonome**, sans dépendances, état en objet JS global, persistance `localStorage`, rendu par re-render complet. Simple et robuste pour prototyper, mais **silos** : pas d'état partagé entre outils (un chantier saisi dans l'estimateur ne remonte pas au dashboard ni au PV).

**Recouvrements métier à arbitrer** : estimateur (prix matériaux) ↔ rentabilité chantier (déboursé→prix) ↔ taux horaire (coût main d'œuvre) ↔ prévisionnel (charges/TVA/statut) manipulent des notions voisines (coûts, marge, TVA, statut). La version unifiée gagnerait à **partager un modèle de données commun** (chantier, profil entreprise, paramètres de prix).

**Maturité globale** : 1 outil en production (estimateur), 6 POC fonctionnels (taux horaire, prévisionnel, rentabilité, décennale, PV, CGV, checklist), 2 coquilles UI (landing, dashboard).

---

## 5. Pistes / chantiers à venir

1. **Trancher la version de référence** de l'estimateur (garder `v8_65_1`, archiver `v8_64` et la copie `_legacy`).
2. **Lancer la migration Next.js** : le scaffold est là mais vide. Définir l'architecture (routing par outil, état partagé, composants communs) avant de porter les outils un à un.
3. **Modèle de données partagé** : entité « chantier » et « profil entreprise » communes à tous les outils, pour que le dashboard agrège réellement.
4. **Harmoniser la charte** (intégrer rentabilité et PV à la palette Figtree/vert).
5. **Brancher le dashboard** sur de vraies données (aujourd'hui en dur).
6. **Statut « Bientôt »** sur la landing : taux horaire et générateur de devis annoncés non dispos — aligner la roadmap avec l'état réel des POC.

---

*Inventaire : 2 estimateurs (racine) + 10 fichiers `_legacy` + scaffold Next.js. Tous les faits techniques ci-dessus sont tirés de la lecture directe du code.*

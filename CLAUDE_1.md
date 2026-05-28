# CLAUDE.md — SOCLE

Fichier de contexte projet. Claude Code le lit à chaque session.
À placer à la racine du repo SOCLE, à commiter dans Git.

---

## Contexte produit

SOCLE est un SaaS pour entrepreneurs du BTP en première année.

- Plans : **Démarrage 19 €/mois**, **Pro 39 €/mois**
- Offre fondateur : **-30 % à vie pour les 100 premiers**
- **ChiffReno** est un MODULE intégré à SOCLE : il alimente le calculateur
  de rentabilité et le générateur de devis avec les coûts matériaux.
  (Le produit B2C ChiffReno autonome est un projet séparé, hors de ce repo.)

## Stack

- Code : GitHub
- Base de données / auth : Supabase
- Déploiement : Vercel

---

## Direction artistique — IMPOSÉE, NON NÉGOCIABLE

La DA est figée. Aucune génération de système alternatif.

- **Couleurs** : blanc, noir, vert `#1a7a3c` uniquement.
- **Typographie** : Figtree 900 pour les titres, DM Mono pour le technique
  et les chiffres.
- **Style** : minimalisme radical. Pas de dégradés, pas d'ombres
  décoratives, pas de remplissage gratuit.

---

## UI UX Pro Max — cadrage

Le plugin UI UX Pro Max est installé. Par défaut il génère un design system
complet (palette, polices, style). **On ne veut pas de ça** : la DA ci-dessus
écrase toute recommandation du skill.

Utilise UI UX Pro Max UNIQUEMENT pour :

- les guidelines UX et les bonnes pratiques d'interaction
- l'accessibilité : contraste 4.5:1 minimum, focus visible au clavier,
  `prefers-reduced-motion` respecté
- la checklist anti-patterns avant livraison
- le responsive : vérifier 375 / 768 / 1024 / 1440 px

Ne génère JAMAIS de palette, de pairing de polices ni de style concurrent.

### Checklist avant de livrer une interface

- [ ] Couleurs limitées à blanc / noir / `#1a7a3c`
- [ ] Figtree 900 titres + DM Mono technique
- [ ] Pas d'emoji en guise d'icône (SVG : Lucide ou Heroicons)
- [ ] `cursor-pointer` sur tout élément cliquable
- [ ] États hover avec transition douce (150-300 ms)
- [ ] Contraste texte ≥ 4.5:1
- [ ] Focus clavier visible
- [ ] `prefers-reduced-motion` respecté
- [ ] Testé en 375 / 768 / 1024 / 1440 px

---

## Règles d'écriture (textes, prose FR de l'app et du marketing)

Tout texte destiné à l'utilisateur (landing, libellés, emails, contenu)
suit ces règles. Objectif : direct, humain, sans tics d'IA.

1. **Couper les amorces creuses.** Pas de « Dans un monde où… »,
   « Il est important de noter que… », « De nos jours… ». Entrer dans le sujet.

2. **Voix active.** Un sujet humain qui fait quelque chose. Éviter le passif
   et les objets qui « agissent » seuls.

3. **Être concret.** Nommer la chose précise (« la pose prend 2 h » plutôt
   que « les délais varient »). Pas d'extrêmes vagues (« toujours »,
   « jamais », « tout le monde ») quand ils ne disent rien.

4. **Parler au lecteur.** « Tu » ou « vous » plutôt que « les gens » ou
   « l'utilisateur ». Concret plutôt qu'abstrait.

5. **Varier le rythme.** Mélanger phrases courtes et longues. Deux exemples
   valent mieux que trois alignés par réflexe. Ne pas finir chaque
   paragraphe sur une punchline.

6. **Faire confiance au lecteur.** Énoncer les faits directement. Pas de
   justification ni de prise par la main inutile. Ne pas expliquer une
   métaphore après l'avoir posée.

7. **Couper le jargon corporate** (« écosystème », « solution clé en main »,
   « disruptif », « à forte valeur ajoutée ») sauf terme technique BTP
   précis et justifié.

### Avant de livrer un texte

- Trois phrases de suite de même longueur ? En casser une.
- Une formule qui annonce son importance sans nommer la chose ? La couper
  ou la remplacer par la chose.
- Du remplissage supprimable sans perte de sens ? Le retirer.

---

## Périmètre

Le cadrage UI et les règles d'écriture s'appliquent au front et aux textes.
La logique métier (calculateur de rentabilité, générateur de devis PDF,
intégration Factur-X, fiches DTU) n'est pas concernée par la DA ni par
UI UX Pro Max.

# 0003 — Web d'abord (TypeScript + Vite + three.js) plutôt qu'un moteur de jeu

- **Statut** : accepté
- **Date** : 2026-09-04

## Contexte

L'original est un jeu Unity vendu sur Steam. Le réflexe serait de prendre un moteur — Unity,
Godot 4 — pour retrouver la même surface d'outillage.

Deux contraintes du projet disent autre chose.

1. **Chaque jalon doit se toucher.** Une tranche verticale doit se lancer par une commande et
   se voir immédiatement. Un moteur impose une installation, un éditeur, un cycle d'export.
2. **L'équilibrage doit être mesurable.** Le cœur du jeu doit tourner sans rendu, en lot, à
   la vitesse du CPU (cf. [ADR 0002](0002-noyau-de-simulation-deterministe.md)). Faire tourner
   un moteur headless pour 3 600 parties est possible mais coûteux ; en TypeScript pur, c'est
   `tsx tools/sim.ts` et rien d'autre.

## Décision

**Vite 7 + TypeScript strict + three.js**, sortie navigateur.

- `tsconfig` en `strict` avec `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`,
  `erasableSyntaxOnly` et `verbatimModuleSyntax` — les erreurs de forme sont attrapées à la
  compilation, pas au premier `undefined` en jeu.
- three.js pour le rendu 3D uniquement. Aucune dépendance de jeu au-delà.
- `vitest` pour les tests, `tsx` pour le simulateur en ligne de commande. Le même code de
  simulation sert les trois surfaces : jeu, tests, campagnes de mesure.

## Alternatives écartées

| Option | Pourquoi non |
| --- | --- |
| **Godot 4** | Le meilleur outillage de *feel* (courbes, tweens, éditeur de scènes) et une vraie sortie Steam. Mais le cœur en GDScript n'est pas pilotable en lot sans faire tourner le moteur, et le jalon n'est plus « une commande » mais « installe l'éditeur ». |
| **Unity** | Même raison, avec en plus une licence et un temps de compilation. |
| **Canvas 2D** | Suffirait pour la simulation, mais la casse d'un objet à trois dimensions est l'essentiel du plaisir : l'aplatir ferait perdre ce qu'on venait chercher. |
| **Rapier / physique dans la boucle** | Rompt le déterminisme, donc la mesure. Voir ADR 0002. |

## Conséquences

- ➕ `npm run dev` et le jeu est à l'écran ; `npm run sim` et l'équilibrage est chiffré.
- ➕ Le bundle fait 527 kB (140 kB gzip), dominé par three.js. Acceptable pour un jeu, à
  surveiller si l'on vise le chargement instantané sur un portail.
- ➖ **Pas de sortie Steam aujourd'hui.** Si elle devient un objectif, l'enveloppe Tauri est
  la voie (le cœur et le rendu ne changent pas) ; cela reste un travail non fait, pas une
  case déjà cochée.
- ➖ Pas d'éditeur visuel : chaque réglage d'équilibrage est une constante dans
  `src/core/balance.ts`. C'est acceptable parce que ce fichier est le *seul* endroit où ces
  constantes existent — et parce que le simulateur remplace l'œil de l'éditeur.

# 0002 — Un noyau de simulation déterministe, sans moteur physique dans la boucle

- **Statut** : accepté
- **Date** : 2026-09-04

## Contexte

OVERDRAFT est un jeu de casse : la tentation naturelle est de brancher un moteur physique
(Rapier, Cannon, Ammo) pour que les tirelires se brisent en morceaux qui rebondissent, et de
faire dépendre les dégâts de la simulation physique.

Cette tentation coûte cher, et elle coûte cher à l'endroit exact où le projet se joue.
Le pari du jeu — que le choix tap/charge est une vraie décision — est une **affirmation
d'équilibrage**. Une affirmation d'équilibrage sans mesure est décorative. La mesurer suppose
de pouvoir jouer des milliers de parties sans rendu, à la même vitesse, avec le même résultat.

Or un moteur physique ne redonne pas le même résultat deux fois : ordre de résolution des
contacts, arithmétique flottante et nombre de sous-pas dépendent de la plateforme et de la
charge machine.

## Décision

**Le cœur du jeu (`src/core/`) est une machine à états pure**, sans aucune dépendance : pas de
DOM, pas de `three`, pas de `Math.random`, pas de `Date.now`.

- Pas fixe de `1/120` s, appliqué à l'identique dans le navigateur et en ligne de commande.
- Tout l'aléatoire vient d'un PRNG **sfc32 sérialisé dans l'état** (`src/core/rng.ts`).
  sfc32 plutôt que mulberry32 : 32 bits d'état donnent une période trop courte pour les
  ~10⁷ tirages d'une campagne de simulation.
- Signature unique : `step(state, dt, inputs) -> events`. Le rendu ne fait que consommer
  l'état et les événements ; il n'écrit jamais dedans.
- **La casse est purement décorative** : éclats à gravité factice, pool fixe de 220 maillages,
  aucune influence sur les dégâts ni sur l'état.

## Conséquences

- ➕ `npm run sim` joue 3 600 parties en ~6 minutes et compare les politiques de frappe.
  Sans cela, l'équilibrage serait une opinion.
- ➕ Une partie est entièrement décrite par `(graine, suite d'entrées)` : rejeu, reproduction
  d'un bug, et plus tard vérification d'un score côté serveur.
- ➕ Le test de déterminisme est réel, avec son contrôle négatif : deux runs de même graine
  dont seule la visée diffère de 3,5 unités doivent diverger. La première version de ce
  contrôle visait du sol vide dans les deux cas et passait à tort.
- ➖ Pas d'éclats qui roulent et s'empilent pour de vrai. On rend l'impact avec du recul
  caméra, un flash d'émission et des éclats jetables — moins riche, et suffisant.
- ➖ Deux représentations à tenir synchronisées (état de simulation ↔ maillages). Le pont
  tient dans une `Map<id, Visual>` et une passe de synchronisation par image.

## Ce que ça a déjà attrapé

Le rendu place le corps d'une tirelire ~0,6 unité au-dessus de sa position au sol. Viser le
plan du sol sous le curseur faisait rater la tirelire sur laquelle le joueur venait de cliquer
— d'autant plus sûrement que le marteau de poche a un rayon nul à charge zéro. Parce que la
simulation est pilotable sans rendu, le défaut s'est vu en pilotant 80 coups depuis la console :
80 coups, 0 cassée. `View.pick()` teste désormais les maillages avant de retomber sur le sol.

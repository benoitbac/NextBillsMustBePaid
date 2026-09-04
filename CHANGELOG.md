# Changelog

Toutes les évolutions notables de ce projet sont documentées ici.

Format inspiré de [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/),
versionnage [SemVer](https://semver.org/lang/fr/).

## [Non publié]

### Ajouté

- **Noyau de simulation déterministe** (`src/core/`) : `step(state, dt, inputs) -> events`,
  pas fixe 1/120, PRNG sfc32 sérialisé dans l'état, aucune dépendance au DOM ni à `three`.
  Une partie est entièrement décrite par `(graine, suite d'entrées)`.
- **Coup à coût choisi** : maintenir charge, relâcher frappe. Dégâts ×(1+4c) contre coût
  ×(1+3,2c), soit +19 % par point de main et −17 % au débit.
- **Six types de tirelires** (classique, ballon, chêne, grelot, jackpot, piège), apparition
  en grappes pour que l'AoE ait un sens et que le terrain se lise.
- **Échéancier** à trois échéances visibles, saisies qui amputent la jauge de main,
  fin de run à trois saisies.
- **Tirage de trois perks** à chaque facture payée — l'escalade à l'intérieur de la run.
- **Faillite déclarée** : rendement en legacy affiché en continu, +25 % par facture payée
  d'avance, moitié seulement si la main lâche avant.
- **Rendu three.js** : tirelires assemblées par type, éclats en pool fixe, anneau de charge,
  recul caméra, HUD complet.
- **Simulateur headless** `npm run sim` : 3 politiques × 4 marteaux, médianes et déciles,
  répartition des fins de run, balayage `--sweep` de l'arbitrage temps/main.
- **17 tests** dont deux contrôles négatifs : la simulation doit diverger quand la visée
  change, et aucun marteau ne doit gagner sur les deux axes du compromis à la fois.
- Bastion du dépôt : structure, CI (typecheck, tests, build, campagne courte), ADR, cockpit.

### Corrigé

- **Visée** : le corps d'une tirelire est dessiné ~0,6 unité au-dessus de sa position au sol ;
  viser le plan du sol ratait la tirelire sur laquelle le joueur venait de cliquer. `View.pick()`
  teste désormais les maillages avant de retomber sur le sol.
- **Masse et batte** : la charge y gagnait sur les deux axes du compromis à la fois, donc le
  choix n'existait pas pour ces deux marteaux. Temps mort ramené de 0,42 à 0,33 et de 0,26
  à 0,24.
- **Métrique du simulateur** : la distribution du legacy est à queue lourde, les moyennes sur
  60 runs mesuraient la chance d'avoir croisé un jackpot. Médianes sur 300 runs désormais.
- **Contrôle négatif du déterminisme** : sa première version visait du sol vide dans les deux
  cas et aurait validé une simulation ignorant la visée.

### Retiré

- **Dette à intérêts composés** : elle écrasait le score final à zéro dans 100 % des parties
  simulées et ne se lisait jamais à l'écran. Remplacée par un compteur de saisies à trois cases.

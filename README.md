<div align="center">

# OVERDRAFT

**Casse des tirelires, paie tes factures, décide quand tout lâcher.**

[![License: MIT](https://img.shields.io/badge/License-MIT-8b7bf5.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178c6.svg)](tsconfig.json)
![Status](https://img.shields.io/badge/sprint%201-jouable-34d399.svg)

</div>

---

## Ce que c'est

Un incrémental **actif** : un marteau, un tapis de tirelires, un échéancier qui ne recule pas.
Chaque coup coûte de la main — on **maintient pour charger**, on **relâche pour frapper**.
Chaque facture payée ouvre un tirage de trois perks. Quand on n'en peut plus, on **déclare
faillite** et on garde le legacy — sauf si la main a lâché avant, auquel cas on n'en garde
que la moitié.

C'est une reprise assumée de la prémisse de *Bills Must Be Paid* (Rike Games), avec une
réponse au reproche que la presse et les joueurs adressent à l'original : **la boucle tourne
en rond passé la quatrième heure.** Le détail des cinq écarts, et l'alternative écartée pour
chacun, est dans [`docs/DESIGN.md`](docs/DESIGN.md).

## Lancer

```bash
npm install
npm run dev          # le jeu, sur http://localhost:5173
```

```bash
npm test             # 17 tests, dont les contrôles négatifs
npm run sim          # campagne de mesure d'équilibrage (headless)
npm run sim -- --sweep   # balayage de l'arbitrage temps/main du bot
npm run build        # typecheck + bundle de production
```

## Le compromis central

Deux ressources contraignent une run, pas une : **la main** termine la partie, **l'horloge**
amène les factures. La charge est économe en main et coûteuse en temps ; le tap l'inverse.
Pour le marteau de poche :

```
tap            6 dgts / 1,0 main = 6,0 dgts/main   |   6 / 0,17 s = 35 dgts/s
charge pleine 30 dgts / 4,2 main = 7,1 dgts/main   |  30 / 1,02 s = 29 dgts/s
```

**+19 % par point de main contre −17 % au débit.** Ces deux nombres sont tenus par un test qui
parcourt les quatre marteaux et échoue dès que l'un gagne sur les deux axes à la fois — c'est
ainsi qu'on a attrapé la masse et la batte, qui dominaient sans le dire.

## Mesurer plutôt qu'affirmer

Le cœur (`src/core/`) est une machine à états déterministe, sans DOM, sans `three`, sans
`Math.random`. Il tourne donc aussi bien dans le navigateur qu'en lot :

```
$ npm run sim -- --runs 300
OVERDRAFT — campagne de 3600 runs simulees en 409.5s
...
Marteau de poche       meilleure: tap        tap vs charge: +195%
Ciseau de precision    meilleure: charge     tap vs charge:  -51%
Masse de chantier      meilleure: charge     tap vs charge:  -56%
Batte cloutee          meilleure: tap        tap vs charge:  +33%
```

Deux marteaux d'un côté, deux de l'autre : **aucune politique fixe ne domine**, ce qui est
exactement la propriété que le design revendique.

L'outil existe pour pouvoir **infirmer** le design : si une politique de frappe gagnait
partout, le choix à chaque coup serait décoratif. C'est arrivé quatre fois pendant la
conception, et à chaque fois c'est l'équilibrage qui a bougé. Les mesures courantes sont dans
[`docs/balance-baseline.txt`](docs/balance-baseline.txt).

Point de méthode : la distribution du legacy est à queue lourde (p90 ≈ 20 à 30 × p10). On
compare des **médianes sur 300 runs**, pas des moyennes sur 60 — celles-ci ne mesuraient que
la chance d'avoir croisé un jackpot.

## Ce qui n'est pas fait

- Le **méta entre les runs** : le legacy s'accumule et se compte, mais il n'achète encore rien.
- Les **quatre marteaux ne sont pas équilibrés entre eux** (facteur ~2 de legacy médian).
- **Ni son, ni manette, ni tactile testé. Pas de sortie Steam.**

La liste complète et honnête est en bas de [`docs/DESIGN.md`](docs/DESIGN.md).

## Repères

- 📐 **[docs/DESIGN.md](docs/DESIGN.md)** — la thèse, les cinq écarts, ce qui reste ouvert.
- 🧭 **[docs/tech/](docs/tech/)** — les ADR (noyau déterministe, web d'abord).
- 📊 **[dashboard/](dashboard/index.html)** — le cockpit : sprints, burn-up, carte système.
- 📖 **[GUIDELINE.md](GUIDELINE.md)** — principes et Definition of Done.

## Licence

[MIT](LICENSE).

<div align="center">
<sub>Fait avec ❤️ par Benoit Bacot.</sub>
</div>

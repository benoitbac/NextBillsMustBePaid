# OVERDRAFT — Guideline

> Document vivant : toute décision structurante se reflète ici et dans le
> [cockpit](dashboard/index.html).

## 1. Vision

Un incrémental **actif** où l'on casse des tirelires pour payer un échéancier qui ne recule
pas. Il reprend la prémisse de *Bills Must Be Paid* et répond au seul reproche que la critique
adresse vraiment à l'original : passé la quatrième heure, la boucle tourne en rond parce
qu'aucune décision n'a d'issue incertaine.

Pour qui : les gens qui jouent aux incrémentaux **en session courte** et veulent que leurs
mains servent à quelque chose — pas ceux qui laissent un onglet tourner la nuit.

La thèse complète, ses cinq écarts et leurs alternatives écartées : **[docs/DESIGN.md](docs/DESIGN.md)**.

## 2. Principes produit

- **Une décision par coup, pas un réflexe.** Charger ou taper doit dépendre du terrain, du
  marteau et de la prochaine échéance. Si une réponse gagne toujours, c'est un bug de design.
- **Tout se lit sans texte.** Le compteur de saisies a trois cases, les pièges ont des pointes,
  l'échéancier montre le temps qui reste. On a déjà remplacé une dette à intérêts composés par
  un compteur à trois cases pour cette seule raison.
- **La fin de run est une décision.** Déclarer faillite rapporte plein ; se faire cueillir par
  l'épuisement rapporte la moitié. La question est *combien de temps encore*, pas *est-ce que
  je survis*.
- **Rien n'est arrondi vers le haut.** Ce qui n'est pas fait est écrit dans le README et dans
  `docs/DESIGN.md`, au même niveau de détail que ce qui l'est.

## 3. Principes techniques

- **Le noyau est pur.** `src/core/` n'importe ni DOM, ni `three`, ni `Math.random`, ni
  `Date.now`. Une entorse à cette règle casse la mesure, donc casse le projet.
- **Toute constante d'équilibrage vit dans `src/core/balance.ts`**, et nulle part ailleurs.
- **Une affirmation d'équilibrage arrive avec sa campagne.** `npm run sim` avant de l'écrire,
  `docs/balance-baseline.txt` régénéré, et les chiffres de la doc mis à jour dans le même
  commit. Une doc en retard sur les nombres ment sur tout le reste.
- **Les médianes, pas les moyennes.** La distribution du legacy est à queue lourde (p90 ≈ 20 à
  30 × p10) ; une moyenne sur quelques dizaines de runs mesure la chance, pas l'équilibrage.
- **TypeScript strict**, avec `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes` et
  `erasableSyntaxOnly`. `npm run typecheck` fait partie du build.

## 4. Architecture cible

| Domaine | Choix | Pourquoi |
| --- | --- | --- |
| Langage | TypeScript strict | Le noyau et les outils partagent le même code, sans passerelle |
| Rendu | three.js | La casse d'un objet 3D est l'essentiel du plaisir ; l'aplatir le perdrait |
| Build | Vite 7 | `npm run dev` et le jalon est à l'écran |
| Simulation | pure, pas fixe 1/120, PRNG sfc32 sérialisé | Rend l'équilibrage mesurable ([ADR 0002](docs/tech/0002-noyau-de-simulation-deterministe.md)) |
| Physique | **aucune dans la boucle** | Un moteur physique ne redonne pas deux fois le même résultat |
| Tests | vitest | Contrôles négatifs compris |
| Déploiement | statique (navigateur) | Une sortie bureau passerait par Tauri — non fait ([ADR 0003](docs/tech/0003-web-d-abord.md)) |

### Découpage

```
src/core/       # la règle du jeu — pure, déterministe, sans dépendance
  balance.ts    #   toutes les constantes d'équilibrage, et rien d'autre
  sim.ts        #   step(state, dt, inputs) -> events
  rng.ts        #   sfc32 sérialisé dans l'état
  bot.ts        #   trois politiques de frappe, pour se contredire
src/game/       # le jeu — consomme l'état, ne l'écrit jamais
tools/sim.ts    # campagnes de mesure headless
tests/          # 17 tests, dont deux contrôles négatifs
docs/           # DESIGN.md, tech/ (ADR), balance-baseline.txt
dashboard/      # le cockpit (coque partagée, données locales)
```

## 5. Definition of Done

Une tâche est finie quand :

1. `npm run typecheck`, `npm test` et `npm run build` passent ;
2. si elle touche l'équilibrage : `npm run sim` a tourné, `docs/balance-baseline.txt` est
   régénéré, et **tous** les chiffres cités dans le README, `docs/DESIGN.md` et le cockpit ont
   été relus ;
3. si elle ajoute une règle : un test la couvre, et un contrôle négatif montre que le test
   échouerait si la règle disparaissait ;
4. si elle change une décision structurante : un ADR est écrit dans `docs/tech/` ;
5. le cockpit est à jour — `roadmap.json` (statuts), `changelog.json` (entrée de session +
   point de burn-up), champ `updated` remonté.

## 6. Ce qui ferait échouer le projet

À relire avant chaque sprint, parce que c'est plus utile qu'une liste d'objectifs :

- Un équilibrage réglé à l'œil, « parce que ça semble mieux ». L'instrument existe : s'en
  passer, c'est revenir au jeu qu'on voulait dépasser.
- Un sprint qui ne produit rien à lancer. Une brique invisible, même excellente, ne se juge pas.
- Une doc qui garde des chiffres périmés. Elle perd alors le droit d'être crue sur le reste.

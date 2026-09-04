# OVERDRAFT — la thèse

> Un incrémental actif meurt quand la seule variable qui bouge est un multiplicateur.

## Ce qu'on reprend, et pourquoi

*Bills Must Be Paid* (Rike Games, 29 juillet 2026, 6,99 €) est à 96 % d'avis positifs sur
3 724 avis. Sa boucle est bonne : casser des tirelires au marteau coûte de la main, les
factures tombent à l'heure, la banqueroute convertit ce qu'on a payé en points de legacy.
La prémisse — *la dette comme antagoniste* — est excellente et vaut la peine d'être reprise.

Ce qu'on ne reprend pas : ni la marque, ni les assets, ni les noms de contenu. Le jeu
s'appelle **OVERDRAFT**, ses tirelires, ses marteaux et ses perks sont les nôtres.

## Ce que la critique reproche à l'original

Les mêmes quatre reproches reviennent dans la presse et les avis :

| Reproche | Ce qu'il dit vraiment |
| --- | --- |
| « ça tourne en rond après ~4 h » | la boucle n'a pas de variance entre deux parties |
| « progression pré-prestige trop lente » | la première run n'a pas d'arc à elle |
| « les mini-jeux de pari divisent » | une décision remplacée par un tirage |
| « la dernière ligne droite traîne » | la difficulté ne monte pas aussi vite que les chiffres |

Les quatre pointent la même chose : **il n'y a pas de décision dont l'issue soit incertaine.**
Chaque run est la précédente, en plus gros.

## Les cinq écarts, et l'alternative écartée pour chacun

### 1. La stamina se dépense, elle ne s'écoule pas

Dans l'original, la main qui fatigue est un minuteur déguisé : un coup, un coût, fin de run.
Ici, **le coût de chaque coup est choisi** — on maintient pour charger, on relâche pour frapper.
La charge coûte plus cher en main mais rend davantage par point dépensé ; le tap est moins
cher mais sort plus vite. Deux ressources contraignent, pas une : la main termine la run,
l'horloge amène les factures.

Chiffres pour le marteau de poche, vérifiés par `tests/sim.test.ts` :

```
tap            6 dgts / 1,0 main = 6,0 dgts/main   |   6 / 0,17 s = 35 dgts/s
charge pleine 30 dgts / 4,2 main = 7,1 dgts/main   |  30 / 1,02 s = 29 dgts/s
```

Soit **+19 % par point de main contre −17 % au débit**. Le test parcourt les quatre marteaux
et échoue si l'un d'eux gagne sur les deux axes à la fois — c'est ainsi qu'on a attrapé la
masse et la batte, qui dominaient silencieusement.

*Alternative écartée :* la régénération passive de stamina. Elle supprime la fin de run et
transforme le jeu en idle — c'est-à-dire en un jeu où l'on ne décide plus rien.

### 2. Le terrain se lit

Les tirelires apparaissent **en grappes**, pas uniformément (62 % des apparitions se collent à
une voisine). Sans grappes, une AoE ne trouve jamais trois cibles et la charge n'a
mathématiquement aucun sens. Avec elles, on vise un amas, pas un point.

Et il y a les **pièges** : ils cassent en huit points de dégâts et coûtent 90 comptant. Une
charge large les ramasse avec le reste. La portée devient donc un risque, pas seulement un
gain — c'est ce qui empêche « toujours charger » d'être une réponse.

*Alternative écartée :* plus de paliers d'amélioration. C'est ce que fait l'original ; ça
allonge sans renouveler.

### 3. Les factures sont un calendrier, pas une surprise

Trois échéances sont visibles en permanence, avec leur montant et le temps restant. Le joueur
planifie sur trois coups d'avance : casser le chêne à 150 PV maintenant, ou trois classiques
pour avoir le loyer dans onze secondes.

Une facture non payée à l'heure déclenche une **saisie** : elle ampute définitivement la jauge
de main de 14 points. **Trois saisies et la run s'arrête.**

*Alternative écartée :* la dette à intérêts composés (notre première version). Mesurée, elle
transformait une mauvaise minute en run déjà perdue sans jamais le dire — et écrasait le score
final à zéro dans 100 % des parties simulées. Un compteur à trois cases se lit d'un coup d'œil ;
une dette qui court ne se lit pas, elle se subit.

### 4. La banqueroute est une décision, pas une fin subie

On déclare faillite quand on veut. Le rendement en legacy est affiché en continu, et il monte
avec chaque facture payée d'avance (+25 % par facture réglée avant échéance). Mais si la main
lâche avant qu'on ait déclaré, **on ne garde que la moitié**.

La question de chaque run n'est donc pas « est-ce que je survis », c'est **« combien de temps
encore »**. C'est la seule décision du jeu dont on ne peut pas calculer la réponse.

*Alternative écartée :* le prestige automatique au game over. Aucune décision, donc aucune
tension.

### 5. Chaque facture payée ouvre un tirage de trois perks

C'est l'escalade *à l'intérieur* d'une run — et la source de variance entre deux parties.
Sans elle, les factures croissent (×1,34 par échéance) et pas les revenus : la run n'est pas
une montée, c'est une pente. La première version du jeu n'avait pas de perks ; la simulation
l'a montré immédiatement, la run mourait toujours à la même facture.

*Alternative écartée :* des améliorations achetées au comptant. Elles auraient mis l'argent en
concurrence avec les factures, ce qui punit deux fois le même mauvais tour.

## Ce qui n'est pas encore réglé

Écrit ici au même niveau de détail que le reste, parce qu'un document qui ne nomme que ses
réussites ne mérite pas d'être cru sur elles.

- **Les quatre marteaux ne sont pas équilibrés entre eux.** L'écart de legacy médian entre le
  meilleur et le pire couple (marteau, politique) reste d'un facteur ~2. Le compromis interne
  à chaque marteau tient ; la parité entre marteaux, non.
- **Le bot adaptatif ne bat pas les politiques fixes.** Il est glouton coup par coup ; il ne
  planifie ni la fenêtre d'une facture ni la fuite d'un jackpot. C'est une ligne de base, pas
  un plafond de compétence — et donc il ne prouve rien sur ce qu'un humain peut atteindre.
- **L'épuisement de la main ne termine presque jamais une run jouée correctement** (< 2 % des
  runs simulées) : un joueur averti déclare avant. La fantaisie « la main lâche » de l'original
  est donc ici une pression, pas une fin.
- **Le méta entre les runs n'existe pas encore.** Le legacy s'accumule et se compte, mais il
  n'achète rien : ni bagues, ni bracelets, ni marteau à débloquer. C'est le sprint suivant, et
  c'est le seul écart où l'original est aujourd'hui plus riche que nous.
- **Ni son, ni manette, ni tactile testé.**

## Comment on vérifie tout ça

`npm run sim` joue des milliers de runs sans rendu et compare les politiques de frappe. Sa
raison d'être est de pouvoir **infirmer** la thèse : si une politique fixe gagnait partout, le
choix à chaque coup serait décoratif et le jeu n'aurait pas d'intérêt.

C'est déjà arrivé quatre fois pendant la conception, et chaque fois l'équilibrage a bougé,
pas l'affirmation. Les mesures courantes sont dans [`balance-baseline.txt`](balance-baseline.txt),
régénérées à chaque changement d'équilibrage.

Un point de méthode qui a compté : la distribution du legacy est **à queue lourde** (p90 vaut
20 à 30 fois p10). Les premières campagnes comparaient des moyennes sur 60 runs — elles ne
mesuraient que la chance d'avoir croisé un jackpot. On compare des **médianes sur 300 runs**.

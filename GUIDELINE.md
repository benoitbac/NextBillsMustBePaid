# NextBillsMustBePaid — Guideline

> Document vivant : toute décision structurante se reflète ici et dans le
> [dashboard](dashboard/index.html).

## 1. Vision

Jeu incrémental actif : casser des tirelires pour payer ses factures — la version dont la boucle tient au-delà de la quatrième heure.

_(Décris en quelques lignes le problème résolu et pour qui.)_

## 2. Principes produit

- **…** : ce qui prime (ex. simplicité, feel, fiabilité).
- **…**
- **…**

## 3. Principes techniques

- **Stack** : à définir / assumée (voir §4).
- **Qualité** : typé, lint/format, tests là où ça compte, CI verte.
- **Perf budget** : à préciser si pertinent.

## 4. Architecture cible

| Domaine   | Choix | Pourquoi |
| --------- | ----- | -------- |
| Langage   |       |          |
| Framework |       |          |
| Données   |       |          |
| Déploiement |     |          |

Décisions techniques détaillées : **[docs/tech/](docs/tech/)** (ADR).

### Découpage

```
src/            # code
docs/           # documentation
  tech/         # décisions techniques (ADR)
dashboard/      # suivi des lots (versionné)
```

## 5. Definition of Done (par tâche)

- [ ] Fonctionne, sans régression ni erreur console.
- [ ] Typé, **lint/format OK**.
- [ ] Testé (ou justifié).
- [ ] Doc / dashboard mis à jour.
- [ ] Commit en **Conventional Commits** (anglais).

## 6. Conventions

- **Commits** : [Conventional Commits](https://www.conventionalcommits.org), en **anglais**, ton technique/précis (quoi + pourquoi).
- **Branches** : `feat/…`, `fix/…`, `docs/…`, `chore/…` ; PR vers `main`.
- **Un lot = un objectif** ; les tâches vivent dans le [dashboard](dashboard/index.html).

## 7. Roadmap

Suivi interactif dans le **[dashboard](dashboard/index.html)**.

| Lot | Objectif | État |
| --- | -------- | ---- |
| A   | Fondations | ✅ |
| B   | Cœur produit | ⏳ |

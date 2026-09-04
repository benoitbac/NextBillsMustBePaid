# 0001 — Utiliser des ADR pour tracer les choix techniques

- **Statut** : accepté
- **Date** : 2026

## Contexte

On veut garder une trace claire du *pourquoi* des choix techniques structurants,
sans polluer le code ni la mémoire des personnes.

## Décision

Chaque décision technique importante fait l'objet d'un **ADR** dans `docs/tech/`,
au format `NNNN-titre.md` (contexte → décision → conséquences).

## Conséquences

- ➕ Décisions traçables, onboarding facilité, débats évités deux fois.
- ➖ Un peu de discipline (écrire l'ADR au moment de décider).

---

_Modèle à copier pour une nouvelle décision :_

```md
# NNNN — Titre

- Statut : proposé | accepté | remplacé par NNNN
- Date : AAAA

## Contexte
## Décision
## Conséquences
## Alternatives écartées
```

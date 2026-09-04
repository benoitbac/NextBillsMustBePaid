# Politique de sécurité

## Signaler une vulnérabilité

Merci de **ne pas** ouvrir d'issue publique pour une faille de sécurité.

Contacte en privé : **Benoit Bacot** (voir le profil GitHub [@benoitbac](https://github.com/benoitbac)),
ou via les [Security Advisories](https://github.com/benoitbac/NextBillsMustBePaid/security/advisories/new) de GitHub.

Merci d'inclure :

- une description de la vulnérabilité et de son impact ;
- les étapes de reproduction (PoC si possible) ;
- la version/le commit concerné.

On s'engage à accuser réception rapidement et à te tenir informé de la correction.

## Bonnes pratiques du projet

- Aucun secret (token, clé, mot de passe) dans le repo — utiliser des variables
  d'environnement / secrets CI (voir `.env.example`).
- Dépendances tenues à jour (Dependabot activé).

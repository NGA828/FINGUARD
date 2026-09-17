#  Tests Postman / Newman — FinGuard

Suite de tests automatisée de l'API FinGuard (54 requêtes, 111 assertions), organisée en
cinq dossiers exécutés dans l'ordre :

| Dossier | Contenu |
|---|---|
| **0 · Authentification** | Connexion des 3 rôles (jetons stockés en variables), 401, `/me`, préparation des limites et du solde pour le scénario de fraude |
| **1 · Espace CLIENT** | Tableau de bord, comptes, filtres, dépôt autorisé, gros virement mis en revue, rejet de limite, CRUD bénéficiaires (+ doublon 409), relevé CSV, notifications, profil |
| **2 · Espace EMPLOYÉ** | Dashboard, clients/comptes, relevé CSV, cas suspects, détail avec analyse + connexes, approbation (+ double approbation refusée), **simulateur de fraude**, litiges, rapport |
| **3 · Espace ADMIN** | Dashboard, employés (aller-retour de rôle), règles de fraude (ajustement + restauration), configuration, audit (la simulation y est journalisée), rapports, **exports CSV** |
| **4 · Sécurité RBAC** | Accès croisés refusés : client → employé/admin (403), employé → admin/client (403), sans jeton (401) |

## Exécution dans Postman (GUI)

1. Démarrer l'API : `cd ../backend/banking-api && npm run start` (port 4000).
2. Dans Postman : **Import** → `FinGuard-API.postman_collection.json`
   (et, optionnel, `FinGuard-Local.postman_environment.json`).
3. Lancer **Run collection** dans l'ordre des dossiers (le dossier 0 connecte les trois
   rôles et prépare les limites ; les suivants s'appuient sur ces variables).

## Exécution en ligne de commande (Newman)

```bash
cd postman
npm install
npm test          # cli + rapport HTML dans reports/FinGuard-API-report.html
```

## Captures d'écran des exécutions

Les captures PNG (fenêtres « terminal » stylisées + carte de synthèse) sont générées à
partir d'une vraie exécution Newman sur un seed réinitialisé, dans
`docs/tests-postman/` :

- `00-synthese.png` — carte de résultats (54/54 requêtes, 111/111 assertions, 0 échec) ;
- `01-authentification.png` → `05-securite-rbac.png` — détail par dossier ;
- `06-…` / `07-…` — exécution complète en deux planches.

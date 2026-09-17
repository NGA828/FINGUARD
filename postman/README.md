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

### Vues façon application Postman (recommandées)

Les captures `postman-ui-*.png` de `docs/tests-postman/` reproduisent l'interface de
l'application Postman (sidebar de collection, barre d'URL + bouton **Send**, onglets de
réponse avec pastille de statut et corps JSON/CSV, vue **Runner**). Les corps affichés
sont les **vraies réponses** renvoyées par l'API FinGuard lors de l'exécution :

| Capture | Scénario | Statut |
|---|---|---|
| `postman-ui-01-login-client.png` | Connexion CLIENT (`/api/auth/login`) | `201 Created` + JWT |
| `postman-ui-02-login-refuse.png` | Mot de passe invalide | `401 Unauthorized` |
| `postman-ui-03-virement-revue.png` | Virement 2 500 000 FCFA → revue de fraude | `201 Created`, `UNDER_REVIEW` |
| `postman-ui-04-releve-csv.png` | Relevé de compte (export CSV) | `200 OK` |
| `postman-ui-05-beneficiaire-doublon.png` | Bénéficiaire en double | `409 Conflict` |
| `postman-ui-06-simulateur-fraude.png` | Simulateur de fraude (employé) | `201 Created` |
| `postman-ui-07-export-admin.png` | Export CSV des transactions (admin) | `200 OK` |
| `postman-ui-08-rbac-403.png` | CLIENT sur route `/employee/*` | `403 Forbidden` |
| `postman-ui-09-runner-resultats.png` | Collection Runner — 54/54 requêtes, 111/111 assertions, 0 échec | ✅ |

### Cartes de synthèse (exécution Newman)

Les captures `00-…` → `07-…` (fenêtres « terminal » stylisées + carte de synthèse) sont
générées à partir d'une vraie exécution Newman sur un seed réinitialisé, dans
`docs/tests-postman/` :

- `00-synthese.png` — carte de résultats (54/54 requêtes, 111/111 assertions, 0 échec) ;
- `01-authentification.png` → `05-securite-rbac.png` — détail par dossier ;
- `06-…` / `07-…` — exécution complète en deux planches.

# 🛡️ Shield

**Système Intelligent de Gestion des Transactions Bancaires et de Détection de Fraude**

Shield est une application web bancaire complète : les clients effectuent des opérations
(dépôts, retraits, virements, paiements), un **moteur intelligent de détection de fraude**
analyse chaque transaction et attribue un niveau de risque **avant** tout traitement,
les employés examinent les cas suspects et résolvent les litiges, et les administrateurs
pilotent le système (employés, règles de fraude, limites, audit, rapports).

---

## 1. Flux de travail central

```
Client initie la transaction
  → Backend valide (auth, solde, limites, compte)
  → Moteur de fraude analyse (montant, fréquence, historique, heure, bénéficiaires…)
  → Score de risque (0-100) + indicateurs
  → FAIBLE  : AUTORISER / TRAITER        (terminée immédiatement)
    MOYEN   : VÉRIFICATION SUPPLÉMENTAIRE (le client confirme ou rejette)
    ÉLEVÉ   : METTRE EN ATTENTE + ALERTE  (examen par un employé)
  → Notification du client / des employés
  → Journal d'audit
```

### Règles de détection (configurables par l'administrateur)

| Code | Indicateur | Poids défaut |
|---|---|---|
| VERY_LARGE_AMOUNT | Montant exceptionnellement élevé (≥ 2 000 000 XAF) | 40 |
| LARGE_AMOUNT | Montant élevé (≥ 1 000 000 XAF) | 25 |
| UNUSUAL_VS_HISTORY | Montant > 4× la moyenne des 10 dernières transactions | 30 |
| HIGH_VELOCITY | ≥ 4 transactions en 10 minutes | 20 |
| ODD_HOURS | Transaction entre 00h et 05h | 15 |
| LARGE_BALANCE_RATIO | ≥ 70 % du solde (sorties) | 20 |
| NEW_BENEFICIARY | Virement vers un compte jamais utilisé | 10 |
| DAILY_VOLUME_HIGH | Volume du jour ≥ 80 % de la limite quotidienne | 10 |

Seuils de classification (configurables) : **MOYEN ≥ 30**, **ÉLEVÉ ≥ 60**.

---

## 2. Architecture technologique

| Couche | Technologie |
|---|---|
| Frontend | **Next.js 14 + TypeScript + Tailwind CSS** (Framer Motion, Recharts, Lucide) |
| Backend | **Node.js + NestJS + TypeScript** (JWT + RBAC, class-validator) |
| Base de données (production) | **MySQL 8+ avec Prisma** — schéma canonique : `backend/banking-api/prisma/schema.prisma` |
| Base de données (exécution démo) | SQLite via `node:sqlite` (DDL 1:1 avec le schéma MySQL : `src/database/schema.sql`) |
| Authentification | JWT + contrôle d'accès par rôle (CLIENT / EMPLOYEE / ADMIN) |

> **Note d'environnement** : le cahier des charges cible MySQL + Prisma. L'environnement
> d'exécution de démonstration n'ayant ni serveur MySQL installable ni accès au CDN des
> moteurs Prisma (`binaries.prisma.sh` bloqué), l'exécution utilise un adaptateur SQLite
> natif de Node (`node:sqlite`) derrière une couche repository isolée ; le schéma Prisma
> MySQL reste la référence de production et correspond 1:1 au DDL d'exécution.

### Structure

```
FINGUARD/
├── backend/banking-api/          # API NestJS (port 4000)
│   ├── prisma/schema.prisma      # Schéma MySQL de production
│   ├── scripts/                  # init-db.ts, seed.ts
│   └── src/
│       ├── auth/                 # JWT, register/login/mot de passe
│       ├── customer/             # Espace CLIENT (RBAC)
│       ├── employee/             # Espace EMPLOYÉ (RBAC)
│       ├── administration/       # Espace ADMIN (RBAC) + configuration
│       ├── accounts/  customers/  employees/
│       ├── transactions/         # Workflow + service bancaire externe simulé
│       ├── fraud/                # Moteur de détection de fraude
│       ├── assistant/            # Chatbot IA (NLU intégré + adaptateur LLM)
│       ├── alerts/  disputes/  notifications/  audit/  reports/
│       ├── common/               # Gardes RBAC, constantes, filtres
│       └── database/             # Connexion SQLite + repositories + DDL
└── frontend/banking-web/         # App Next.js (port 3000)
    └── src/
        ├── app/                  # landing, auth, customer, employee, admin
        ├── components/           # AppShell, UI animée, graphiques, modales
        ├── lib/                  # client API, auth, hooks, libellés FR
        └── styles/               # design system Tailwind
```

---

## 3. Démarrage

📘 **Guide complet (installation pas à pas + utilisation des trois espaces) :**
[`docs/GUIDE_UTILISATEUR.pdf`](docs/GUIDE_UTILISATEUR.pdf) — version PDF,
ou [`docs/GUIDE_UTILISATEUR.md`](docs/GUIDE_UTILISATEUR.md) pour la source Markdown.

```bash
# Backend
cd backend/banking-api
npm install
npm run db:setup        # crée le schéma + données de démonstration
npm run start           # → http://localhost:4000/api

# Frontend
cd frontend/banking-web
npm install
npm run dev             # → http://localhost:3000 (proxie /api → :4000)
```

Production MySQL : `npx prisma db push --schema prisma/schema.prisma` après avoir défini
`DATABASE_URL`, puis brancher les repositories sur Prisma (mêmes entités, mêmes champs).

---

## 4. Comptes de démonstration

| Rôle | E-mail | Mot de passe |
|---|---|---|
| **Administrateur** | admin@finguard.com | Admin123! |
| **Employé** | marie.kouassi@finguard.com | Employe123! |
| **Employé** | emmanuel.njoya@finguard.com | Employe123! |
| **Client** | client@demo.com | Client123! |

Le seed crée aussi 7 autres clients avec 30 jours d'historique, dont :
- **le scénario du cahier des charges** : virement de 2 000 000 XAF de Jean Kamga → score 85 →
  mis en attente + alerte de fraude ouverte (à examiner côté employé) ;
- un retrait de 450 000 XAF **en attente de confirmation client** (risque moyen) ;
- un litige **en investigation** (paiement e-commerce non reconnu) ;
- un compte **gelé** (Ibrahim Sali) et un cas **escaladé à l'administration** (Amina Ndong).

---

## 5. Sécurité & RBAC

- Chaque espace est protégé par `JwtAuthGuard` **puis** `RolesGuard` ; un CLIENT reçoit `403`
  sur `/employee/*` et `/admin/*` même en forçant l'URL (vérifié par tests).
- Validation systématique des entrées (class-validator), messages d'erreur en français.
- Soldes et limites vérifiés au moment du traitement ; mouvements de soldes **atomiques**
  (transactions SQL) ; gel/dégel de comptes journalisé.
- Journal d'audit : connexions, créations, approbations/rejets, gels, escalades, configurations.

---

## 6. Design

Interface inspirée des références Dribbble du cahier des charges :
landing fintech sombre avec hero animé, bouclier IA et compteurs ; tableaux de bord clairs
centrés sur le solde et les actions rapides ; vues de détection de fraude data-driven avec
scores, indicateurs et alertes rouge/orange ; animations Framer Motion (révélations au scroll,
compteurs, transitions de pages, modales spring, toasts) et images générées sur mesure
(`frontend/banking-web/public/images/`).

---

## 7. Fonctionnalités complémentaires

### 👥 Bénéficiaires (client)
- CRUD complet : `GET/POST /api/customer/beneficiaries`, `DELETE /api/customer/beneficiaries/:id`
  (unicité client + numéro de compte, refus de doublon en `409`).
- Page **« Mes bénéficiaires »** (cartes animées, ajout en modale, retrait avec confirmation).
- Lors d'un virement, la modale « Nouvelle transaction » propose la **sélection d'un
  bénéficiaire enregistré** pour pré-remplir le compte destinataire.

### 📄 Relevés de compte (export CSV)
- `GET /api/customer/accounts/:id/statement` et `GET /api/employee/accounts/:id/statement`
  → fichier CSV `;` avec BOM UTF-8 (compatible Excel) :
  `Date;Référence;Type;Description;Sens;Montant (XAF);Statut`.
- Boutons de téléchargement : tableau de bord client (chaque compte), page
  « Mes transactions », et fiche client côté employé.

### 📊 Exports administrateur
- `GET /api/admin/reports/transactions.csv` — toutes les transactions du système,
  filtrables par statut/type/période.
- `GET /api/admin/reports/audit.csv` — journal d'audit exportable.
- Carte « Exports CSV » dans **Rapports système** (filtres statut/type).

### 🧪 Simulateur de fraude (employé)
- `POST /api/employee/transactions/simulate` — évalue le score de risque d'une opération
  fictive **sans mouvement de fonds ni écriture en base** (journalisé en audit).
- Bannière + modale interactive sur le tableau de bord employé : compte, type, montant →
  score /100, jauge animée, indicateurs déclenchés et décision automatique du moteur.

### 📈 Graphique de dépenses (client)
- Le tableau de bord client affiche la **répartition des dépenses sortantes (30 jours)**
  par type d'opération (donut Recharts + légende avec pourcentages).

### 🤖 Assistant IA (client) — conversationnel + vocal
Un **chatbot** dédié (`/customer/assistant`) permet au client de dialoguer avec la banque :

| Fonction | Exemple de question |
|---|---|
| Solde en temps réel | « Quel est mon solde ? » |
| Dernières transactions (avec cartes riches) | « Mes dernières transactions » |
| Statut d'une transaction par référence | « Quel est le statut de TX-2026-274720 ? » |
| **Niveau de risque + explication** du moteur de fraude | « Pourquoi ma transaction est bloquée ? » |
| Opérations en attente / à confirmer | « Y a-t-il des opérations en attente ? » |
| Litiges | « Je ne reconnais pas cette transaction » |
| FAQ : frais, limites/plafonds, détection de fraude, sécurité, contact | « Comment fonctionne la détection de fraude ? » |

**Architecture**
- **Moteur NLU intégré** (`backend/banking-api/src/assistant/nlu.ts`) : détection
  d'intention par mots-clés pondérés (FR + EN), extraction de référence `TX-…` et de type
  d'opération. Fonctionne **100 % hors-ligne**, sans clé API.
- **LLM-ready** (`llm.service.ts`) : pour brancher un vrai modèle, ajouter dans
  `backend/banking-api/.env` (voir `.env.example`) :

  **Option recommandée — Google Gemini (gratuit)** : clé gratuite sur
  [Google AI Studio](https://aistudio.google.com/apikey), puis :
  ```env
  LLM_PROVIDER=gemini
  LLM_API_KEY=AIza...
  # LLM_MODEL=gemini-2.5-flash (défaut) — endpoint de compatibilité OpenAI auto
  ```
  Tout endpoint OpenAI-like fonctionne aussi (`LLM_PROVIDER=openai` +
  `LLM_BASE_URL` pour OpenRouter, Mistral, Ollama…). Le LLM reçoit le contexte
  live du client (soldes, dernières transactions, limites) et prend le relais sur
  les questions ouvertes ; en cas d'échec, repli automatique sur le moteur intégré.
- **Voix** : notes vocales entrantes (reconnaissance vocale du navigateur) et réponses
  lues à voix haute (synthèse vocale) — aucune API externe requise.
- **RBAC** : les routes `GET /api/customer/assistant/welcome` et
  `POST /api/customer/assistant/chat` sont réservées au rôle `CLIENT`.

### 📚 Documentation Swagger
- Disponible sur `http://localhost:4000/api/docs` (JSON : `/api/docs-json`).

### ✅ Tests de bout en bout
- `cd backend/banking-api && npm run test:e2e` — 10 scénarios contre l'API en fonctionnement :
  authentification, RBAC croisé (client ↔ employé ↔ admin), petit dépôt autorisé, gros
  virement mis en revue puis approuvé, rejet au-delà de la limite par transaction, CRUD
  bénéficiaires + doublon, relevés CSV (dont accès interdit au compte d'autrui), simulation
  sans mouvement de fonds, attribution de rôle admin.

---

## 8. Tests Postman / Newman & captures d'écran

- **Collection Postman** : `postman/FinGuard-API.postman_collection.json` — 54 requêtes
  et 111 assertions en français, réparties en 5 dossiers : authentification (3 rôles),
  espace CLIENT (bénéficiaires, relevé CSV, fraude), espace EMPLOYÉ (revue, simulateur),
  espace ADMIN (règles, exports CSV, audit) et sécurité RBAC (403/401).
- **Exécution CLI** : `cd postman && npm install && npm test` (rapport HTML dans
  `postman/reports/`). La collection se prépare seule (limites + solde) pour être
  rejouable depuis un seed vierge.
- **Captures d'écran des tests** : `docs/tests-postman/` — vues façon application
  Postman (`postman-ui-01` → `postman-ui-09`, corps de réponses réels + Collection
  Runner 54/54 · 111/111 · 0 échec) et cartes de synthèse Newman
  (`00-synthese.png`, détail par dossier `01` → `05`, exécution complète `06`, `07`).

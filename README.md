# 🛡️ FinGuard

**Système Intelligent de Gestion des Transactions Bancaires et de Détection de Fraude**

FinGuard est une application web bancaire complète : les clients effectuent des opérations
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

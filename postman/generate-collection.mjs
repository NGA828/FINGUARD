/**
 * Génère la collection Postman « Shield — API Bancaire & Détection de Fraude ».
 * Usage : node generate-collection.mjs  →  Shield-API.postman_collection.json
 *
 * La collection couvre : authentification, espaces CLIENT / EMPLOYÉ / ADMIN,
 * bénéficiaires, relevés CSV, exports admin, simulateur de fraude, et RBAC.
 */
import { writeFileSync } from 'node:fs';

const V = {
  set: (k, expr) => `pm.collectionVariables.set('${k}', ${expr});`,
};

const authHeader = (tokenVar) => ({ key: 'Authorization', value: `Bearer {{${tokenVar}}}` });

const req = ({ name, method = 'GET', path, body, rawBody, token, tests = [], description }) => ({
  name,
  event: [
    {
      listen: 'test',
      script: {
        type: 'text/javascript',
        exec: [`// ${name}`, ...tests],
      },
    },
  ],
  request: {
    method,
    header: token ? [authHeader(token)] : [],
    url: `{{baseUrl}}${path}`,
    ...(body !== undefined ? { body: { mode: 'raw', raw: JSON.stringify(body, null, 2), options: { raw: { language: 'json' } } } } : {}),
    ...(rawBody !== undefined ? { body: { mode: 'raw', raw: rawBody, options: { raw: { language: 'json' } } } } : {}),
    description,
  },
});

/* ------------------------------------------------------------------ */
/* 0 — Authentification                                                */
/* ------------------------------------------------------------------ */
const authFolder = {
  name: '0 · Authentification',
  description: 'Connexion des trois rôles (les jetons sont stockés en variables de collection), cas d’échec, et préparation des limites pour les scénarios de fraude.',
  item: [
    req({
      name: 'Connexion administrateur',
      method: 'POST',
      path: '/auth/login',
      body: { email: 'admin@shield.com', password: 'Admin123!' },
      tests: [
        "pm.test('Statut 201 — connexion réussie', () => pm.response.to.have.status(201));",
        'const body = pm.response.json();',
        "pm.test('Jeton JWT émis', () => pm.expect(body.accessToken).to.be.a('string').and.not.empty);",
        "pm.test('Rôle ADMIN', () => pm.expect(body.user.role).to.eql('ADMIN'));",
        V.set('adminToken', 'body.accessToken'),
      ],
    }),
    req({
      name: 'Connexion employé',
      method: 'POST',
      path: '/auth/login',
      body: { email: 'marie.kouassi@shield.com', password: 'Employe123!' },
      tests: [
        "pm.test('Statut 201 — connexion réussie', () => pm.response.to.have.status(201));",
        'const body = pm.response.json();',
        "pm.test('Rôle EMPLOYEE', () => pm.expect(body.user.role).to.eql('EMPLOYEE'));",
        V.set('employeeToken', 'body.accessToken'),
      ],
    }),
    req({
      name: 'Connexion client',
      method: 'POST',
      path: '/auth/login',
      body: { email: 'client@demo.com', password: 'Client123!' },
      tests: [
        "pm.test('Statut 201 — connexion réussie', () => pm.response.to.have.status(201));",
        'const body = pm.response.json();',
        "pm.test('Rôle CLIENT', () => pm.expect(body.user.role).to.eql('CLIENT'));",
        V.set('clientToken', 'body.accessToken'),
      ],
    }),
    req({
      name: 'Connexion refusée (mauvais mot de passe)',
      method: 'POST',
      path: '/auth/login',
      body: { email: 'client@demo.com', password: 'MauvaisMotDePasse' },
      tests: [
        "pm.test('Statut 401 — identifiants invalides', () => pm.response.to.have.status(401));",
        "pm.test('Message d’erreur en français', () => pm.expect(pm.response.json().message).to.match(/[Ii]nvalid|incorrect|éché/i));",
      ],
    }),
    req({
      name: 'Profil courant (/auth/me)',
      path: '/auth/me',
      token: 'clientToken',
      tests: [
        "pm.test('Statut 200', () => pm.response.to.have.status(200));",
        "pm.test('E-mail du client de démonstration', () => pm.expect(pm.response.json().email).to.eql('client@demo.com'));",
      ],
    }),
    req({
      name: 'Préparation · Limites globales (admin)',
      method: 'POST',
      path: '/admin/config',
      token: 'adminToken',
      body: { values: { GLOBAL_PER_TX_LIMIT: '50000000', GLOBAL_DAILY_LIMIT: '500000000' } },
      description: 'Relève les limites globales pour rendre les scénarios de fraude exécutables et rejouables.',
      tests: [
        "pm.test('Statut 200 ou 201', () => pm.expect(pm.response.code).to.be.oneOf([200, 201]));",
      ],
    }),
    req({
      name: 'Préparation · Identifier le compte de démonstration',
      path: '/employee/accounts',
      token: 'employeeToken',
      tests: [
        "pm.test('Statut 200', () => pm.response.to.have.status(200));",
        'const accounts = pm.response.json();',
        "pm.test('Liste de comptes non vide', () => pm.expect(accounts).to.be.an('array').and.not.empty);",
        "const demo = accounts.find((a) => a.accountNumber === 'FG-10000101');",
        "pm.test('Compte FG-10000101 présent', () => pm.expect(demo).to.be.an('object'));",
        V.set('demoAccountId', 'demo.id'),
      ],
    }),
    req({
      name: 'Préparation · Limites du compte de démonstration',
      method: 'PATCH',
      path: '/employee/accounts/{{demoAccountId}}',
      token: 'employeeToken',
      body: { dailyLimit: 500000000, perTxLimit: 5000000 },
      tests: [
        "pm.test('Statut 200 — limites relevées', () => pm.response.to.have.status(200));",
      ],
    }),
    req({
      name: 'Préparation · Provisionner le compte (dépôt 3 M)',
      method: 'POST',
      path: '/customer/transactions',
      token: 'clientToken',
      body: { type: 'DEPOSIT', amount: 3000000, accountId: '{{demoAccountId}}', description: 'Provisionnement Postman' },
      description: 'Le solde initial du seed ne permet pas un virement de 2,5 M : on provisionne le compte avant le scénario de fraude.',
      tests: [
        "pm.test('Statut 201 — dépôt créé', () => pm.response.to.have.status(201));",
        'const r = pm.response.json();',
        V.set('fundingTxId', 'r.id'),
        V.set('fundingStatus', 'r.status'),
        "pm.test('Statut du dépôt cohérent', () => pm.expect(['COMPLETED', 'PENDING', 'UNDER_REVIEW']).to.include(r.status));",
      ],
    }),
    req({
      name: 'Préparation · Confirmer le dépôt (client, si vérification)',
      method: 'POST',
      path: '/customer/transactions/{{fundingTxId}}/confirm',
      token: 'clientToken',
      body: { legitimate: true },
      description: 'Si le moteur a demandé une vérification client (PENDING), la confirmation crédite le compte ; sinon l’API renvoie 400, ce qui est correct.',
      tests: [
        'const s = pm.collectionVariables.get("fundingStatus");',
        "if (s === 'PENDING') {",
        "  pm.test('Statut 201 — dépôt confirmé et crédité', () => pm.expect(pm.response.code).to.be.oneOf([200, 201]));",
        '} else {',
        "  pm.test('Confirmation sans objet (dépôt déjà traité ou en revue)', () => pm.response.to.have.status(400));",
        '}',
      ],
    }),
    req({
      name: 'Préparation · Approuver le dépôt (employé, si revue)',
      method: 'POST',
      path: '/employee/transactions/{{fundingTxId}}/approve',
      token: 'employeeToken',
      body: { notes: 'Provisionnement du scénario Postman' },
      description: 'Si le dépôt a été classé à risque élevé (UNDER_REVIEW), l’employé l’approuve pour créditer le compte ; sinon 400, ce qui est correct.',
      tests: [
        'const s = pm.collectionVariables.get("fundingStatus");',
        "if (s === 'UNDER_REVIEW') {",
        "  pm.test('Statut 201 — dépôt approuvé et crédité', () => pm.expect(pm.response.code).to.be.oneOf([200, 201]));",
        '} else {',
        "  pm.test('Approbation sans objet (dépôt hors revue employé)', () => pm.response.to.have.status(400));",
        '}',
      ],
    }),
  ],
};

/* ------------------------------------------------------------------ */
/* 1 — Espace CLIENT                                                   */
/* ------------------------------------------------------------------ */
const customerFolder = {
  name: '1 · Espace CLIENT',
  description: 'Opérations bancaires du client : tableau de bord, transactions, bénéficiaires, relevé CSV, notifications.',
  item: [
    req({
      name: 'Tableau de bord client',
      path: '/customer/dashboard',
      token: 'clientToken',
      tests: [
        "pm.test('Statut 200', () => pm.response.to.have.status(200));",
        'const d = pm.response.json();',
        "pm.test('Comptes et solde présents', () => { pm.expect(d.accounts).to.be.an('array'); pm.expect(d.balance).to.be.a('number'); });",
        "pm.test('Totaux mensuels (30 j)', () => pm.expect(d.monthlyTotals).to.include.any.keys('deposits', 'withdrawals', 'transfers', 'payments'));",
        "pm.test('Répartition des dépenses', () => pm.expect(d.spending).to.be.an('array'));",
      ],
    }),
    req({
      name: 'Mes comptes',
      path: '/customer/accounts',
      token: 'clientToken',
      tests: [
        "pm.test('Statut 200', () => pm.response.to.have.status(200));",
        'const accounts = pm.response.json();',
        "pm.test('Au moins un compte', () => pm.expect(accounts).to.be.an('array').and.not.empty);",
        "pm.test('Numéro au format FG-XXXXXXXX', () => pm.expect(accounts[0].accountNumber).to.match(/^FG-\\d{8}$/));",
        V.set('myAccountId', 'accounts[0].id'),
      ],
    }),
    req({
      name: 'Mes transactions (avec filtres)',
      path: '/customer/transactions?type=&status=&q=&limit=10',
      token: 'clientToken',
      tests: [
        "pm.test('Statut 200', () => pm.response.to.have.status(200));",
        "pm.test('Liste paginée', () => pm.expect(pm.response.json().items).to.be.an('array'));",
      ],
    }),
    req({
      name: 'Petit dépôt (risque faible → autorisé)',
      method: 'POST',
      path: '/customer/transactions',
      token: 'clientToken',
      body: { type: 'DEPOSIT', amount: 25000, accountId: '{{myAccountId}}', description: 'Dépôt Postman' },
      tests: [
        "pm.test('Statut 201 — transaction créée', () => pm.response.to.have.status(201));",
        'const r = pm.response.json();',
        "pm.test('Référence émise', () => pm.expect(r.reference).to.match(/^TX-/));",
        "pm.test('Traitée ou en vérification', () => pm.expect(['COMPLETED', 'PENDING']).to.include(r.status));",
      ],
    }),
    req({
      name: 'Gros virement (score élevé → revue ou vérification)',
      method: 'POST',
      path: '/customer/transactions',
      token: 'clientToken',
      body: { type: 'TRANSFER', amount: 2500000, targetAccountNumber: 'FG-10000102', description: 'Virement Postman' },
      tests: [
        "pm.test('Statut 201', () => pm.response.to.have.status(201));",
        'const r = pm.response.json();',
        "pm.test('Jamais traitée directement (risque détecté)', () => pm.expect(['UNDER_REVIEW', 'PENDING']).to.include(r.status));",
        "pm.test('Niveau de risque moyen ou élevé', () => pm.expect(['MEDIUM', 'HIGH']).to.include(r.analysis ? r.analysis.riskLevel : r.riskLevel));",
        V.set('reviewTxId', 'r.id'),
        V.set('reviewStatus', 'r.status'),
      ],
    }),
    req({
      name: 'Dépassement de limite (rejeté)',
      method: 'POST',
      path: '/customer/transactions',
      token: 'clientToken',
      body: { type: 'WITHDRAWAL', amount: 99999999 },
      tests: [
        "pm.test('Statut 400 — limite dépassée', () => pm.response.to.have.status(400));",
        "pm.test('Message mentionne la limite', () => pm.expect(String(pm.response.json().message)).to.match(/limite/i));",
      ],
    }),
    req({
      name: 'Bénéficiaires · Liste',
      path: '/customer/beneficiaries',
      token: 'clientToken',
      tests: [
        "pm.test('Statut 200', () => pm.response.to.have.status(200));",
        "pm.test('Tableau de bénéficiaires', () => pm.expect(pm.response.json()).to.be.an('array'));",
      ],
    }),
    req({
      name: 'Bénéficiaires · Ajout',
      method: 'POST',
      path: '/customer/beneficiaries',
      token: 'clientToken',
      body: { name: 'Test Postman {{$timestamp}}', accountNumber: 'FG-10000105', bankLabel: 'Shield Bank' },
      tests: [
        "pm.test('Statut 201 — bénéficiaire créé', () => pm.response.to.have.status(201));",
        'const b = pm.response.json();',
        "pm.test('Champs normalisés', () => pm.expect(b.accountNumber).to.eql('FG-10000105'));",
        V.set('benefId', 'b.id'),
      ],
    }),
    req({
      name: 'Bénéficiaires · Doublon refusé (409)',
      method: 'POST',
      path: '/customer/beneficiaries',
      token: 'clientToken',
      body: { name: 'Test Postman doublon', accountNumber: 'FG-10000105' },
      tests: [
        "pm.test('Statut 409 — conflit', () => pm.response.to.have.status(409));",
        "pm.test('Message de doublon en français', () => pm.expect(pm.response.json().message).to.match(/déjà/i));",
      ],
    }),
    req({
      name: 'Bénéficiaires · Suppression',
      method: 'DELETE',
      path: '/customer/beneficiaries/{{benefId}}',
      token: 'clientToken',
      tests: [
        "pm.test('Statut 200 — suppression effectuée', () => pm.response.to.have.status(200));",
        "pm.test('Confirmation deleted', () => pm.expect(pm.response.json().deleted).to.eql(true));",
      ],
    }),
    req({
      name: 'Relevé de compte (export CSV)',
      path: '/customer/accounts/{{myAccountId}}/statement',
      token: 'clientToken',
      tests: [
        "pm.test('Statut 200', () => pm.response.to.have.status(200));",
        "pm.test('Content-Type CSV', () => pm.expect(pm.response.headers.get('Content-Type')).to.include('text/csv'));",
        "pm.test('En-têtes du relevé', () => pm.expect(pm.response.text()).to.include('Date;Référence;Type;Description;Sens;Montant (XAF);Statut'));",
        "pm.test('Nom de fichier releve-*.csv', () => pm.expect(pm.response.headers.get('Content-Disposition')).to.match(/releve-FG-\\d{8}\\.csv/));",
      ],
    }),
    req({
      name: 'Notifications',
      path: '/notifications',
      token: 'clientToken',
      tests: [
        "pm.test('Statut 200', () => pm.response.to.have.status(200));",
        'const n = pm.response.json();',
        "pm.test('Liste de notifications', () => pm.expect(Array.isArray(n) ? n : n.items).to.be.an('array'));",
      ],
    }),
    req({
      name: 'Mon profil',
      path: '/customer/profile',
      token: 'clientToken',
      tests: [
        "pm.test('Statut 200', () => pm.response.to.have.status(200));",
        "pm.test('Profil avec utilisateur et e-mail', () => pm.expect(pm.response.json().user.email).to.be.a('string'));",
      ],
    }),
  ],
};

/* ------------------------------------------------------------------ */
/* 2 — Espace EMPLOYÉ                                                  */
/* ------------------------------------------------------------------ */
const employeeFolder = {
  name: '2 · Espace EMPLOYÉ',
  description: 'Gestion clientèle, revue des transactions suspectes, simulateur de fraude, relevés et rapports.',
  item: [
    req({
      name: 'Tableau de bord employé',
      path: '/employee/dashboard',
      token: 'employeeToken',
      tests: [
        "pm.test('Statut 200', () => pm.response.to.have.status(200));",
        "pm.test('Statistiques présentes', () => pm.expect(pm.response.json().stats).to.include.any.keys('totalCustomers', 'activeAccounts', 'suspicious'));",
      ],
    }),
    req({
      name: 'Liste des clients',
      path: '/employee/customers',
      token: 'employeeToken',
      tests: [
        "pm.test('Statut 200', () => pm.response.to.have.status(200));",
        'const list = pm.response.json();',
        "pm.test('Au moins un client', () => pm.expect(list).to.be.an('array').and.not.empty);",
        V.set('firstCustomerId', 'list[0].id'),
      ],
    }),
    req({
      name: 'Détail d’un client (comptes + activité)',
      path: '/employee/customers/{{firstCustomerId}}',
      token: 'employeeToken',
      tests: [
        "pm.test('Statut 200', () => pm.response.to.have.status(200));",
        'const c = pm.response.json();',
        "pm.test('Fiche avec utilisateur et comptes', () => { pm.expect(c.user).to.be.an('object'); pm.expect(c.accounts).to.be.an('array'); });",
      ],
    }),
    req({
      name: 'Liste des comptes',
      path: '/employee/accounts',
      token: 'employeeToken',
      tests: [
        "pm.test('Statut 200', () => pm.response.to.have.status(200));",
        "pm.test('Comptes avec titulaires', () => pm.expect(pm.response.json()[0]).to.include.any.keys('accountNumber', 'customerName'));",
      ],
    }),
    req({
      name: 'Relevé de compte (export CSV employé)',
      path: '/employee/accounts/{{demoAccountId}}/statement',
      token: 'employeeToken',
      tests: [
        "pm.test('Statut 200', () => pm.response.to.have.status(200));",
        "pm.test('Content-Type CSV', () => pm.expect(pm.response.headers.get('Content-Type')).to.include('text/csv'));",
        "pm.test('En-têtes du relevé', () => pm.expect(pm.response.text()).to.include('Date;Référence'));",
      ],
    }),
    req({
      name: 'Transactions suspectes',
      path: '/employee/suspicious',
      token: 'employeeToken',
      tests: [
        "pm.test('Statut 200', () => pm.response.to.have.status(200));",
        "pm.test('Tableau de cas suspects', () => pm.expect(pm.response.json()).to.be.an('array'));",
      ],
    }),
    req({
      name: 'Détail de la transaction en revue (analyse + connexes)',
      path: '/employee/transactions/{{reviewTxId}}',
      token: 'employeeToken',
      tests: [
        "pm.test('Statut 200', () => pm.response.to.have.status(200));",
        'const t = pm.response.json();',
        "pm.test('Analyse de fraude jointe', () => pm.expect(t.analysis).to.be.an('object'));",
        "pm.test('Transactions connexes', () => pm.expect(t.relatedTransactions).to.be.an('array'));",
      ],
    }),
    req({
      name: 'Approbation employé (si mise en revue)',
      method: 'POST',
      path: '/employee/transactions/{{reviewTxId}}/approve',
      token: 'employeeToken',
      body: { notes: 'Approuvée via Postman' },
      description: 'Si le moteur a classé la transaction UNDER_REVIEW, l’approbation aboutit (201) ; si elle attend une vérification client (PENDING), l’API renvoie 400 : les deux comportements sont corrects et vérifiés.',
      tests: [
        'const attendu = pm.collectionVariables.get("reviewStatus") === "UNDER_REVIEW" ? 201 : 400;',
        "pm.test('Décision conforme au circuit de fraude', () => pm.expect(pm.response.code).to.eql(attendu));",
        'if (attendu === 201) {',
        "  pm.test('Transaction approuvée et traitée', () => {",
        '    const r = pm.response.json();',
        "    pm.expect(['COMPLETED', 'PROCESSING']).to.include(r.status);",
        '  });',
        '}',
      ],
    }),
    req({
      name: 'Double approbation refusée (400)',
      method: 'POST',
      path: '/employee/transactions/{{reviewTxId}}/approve',
      token: 'employeeToken',
      body: { notes: 'Tentative de double approbation' },
      tests: [
        "pm.test('Statut 400 — opération déjà traitée ou hors circuit employé', () => pm.response.to.have.status(400));",
      ],
    }),
    req({
      name: 'Simulateur de fraude (aucun mouvement de fonds)',
      method: 'POST',
      path: '/employee/transactions/simulate',
      token: 'employeeToken',
      body: { accountId: '{{demoAccountId}}', type: 'TRANSFER', amount: 2500000 },
      tests: [
        "pm.test('Statut 201', () => pm.response.to.have.status(201));",
        'const r = pm.response.json();',
        "pm.test('Marquée comme simulation', () => pm.expect(r.simulation).to.eql(true));",
        "pm.test('Score de risque numérique', () => pm.expect(r.analysis.riskScore).to.be.a('number'));",
        "pm.test('Niveau de risque valide', () => pm.expect(['LOW', 'MEDIUM', 'HIGH']).to.include(r.analysis.riskLevel));",
        "pm.test('Décision du moteur', () => pm.expect(['AUTHORIZE', 'VERIFY', 'HOLD']).to.include(r.analysis.action));",
      ],
    }),
    req({
      name: 'Litiges',
      path: '/employee/disputes',
      token: 'employeeToken',
      tests: [
        "pm.test('Statut 200', () => pm.response.to.have.status(200));",
        "pm.test('Tableau de litiges', () => pm.expect(pm.response.json()).to.be.an('array'));",
      ],
    }),
    req({
      name: 'Rapport quotidien',
      path: '/employee/reports/daily',
      token: 'employeeToken',
      tests: [
        "pm.test('Statut 200', () => pm.response.to.have.status(200));",
      ],
    }),
  ],
};

/* ------------------------------------------------------------------ */
/* 3 — Espace ADMIN                                                    */
/* ------------------------------------------------------------------ */
const adminFolder = {
  name: '3 · Espace ADMIN',
  description: 'Pilotage du système : employés, règles de fraude, configuration, audit, rapports et exports CSV.',
  item: [
    req({
      name: 'Tableau de bord système',
      path: '/admin/dashboard',
      token: 'adminToken',
      tests: ["pm.test('Statut 200', () => pm.response.to.have.status(200));"],
    }),
    req({
      name: 'Liste des employés',
      path: '/admin/employees',
      token: 'adminToken',
      tests: [
        "pm.test('Statut 200', () => pm.response.to.have.status(200));",
        'const list = pm.response.json();',
        "pm.test('Au moins un employé', () => pm.expect(list).to.be.an('array').and.not.empty);",
        "const cible = list.find((e) => e.role === 'EMPLOYEE');",
        "pm.test('Un employé cible trouvé pour l’aller-retour de rôle', () => pm.expect(cible).to.be.an('object'));",
        V.set('targetEmployeeId', 'cible.id'),
      ],
    }),
    req({
      name: 'Rôle · Promotion en ADMIN',
      method: 'PATCH',
      path: '/admin/employees/{{targetEmployeeId}}',
      token: 'adminToken',
      body: { role: 'ADMIN' },
      tests: [
        "pm.test('Statut 200', () => pm.response.to.have.status(200));",
        "pm.test('Rôle mis à jour', () => pm.expect(pm.response.json().role).to.eql('ADMIN'));",
      ],
    }),
    req({
      name: 'Rôle · Retour au rôle EMPLOYEE',
      method: 'PATCH',
      path: '/admin/employees/{{targetEmployeeId}}',
      token: 'adminToken',
      body: { role: 'EMPLOYEE' },
      tests: [
        "pm.test('Statut 200', () => pm.response.to.have.status(200));",
        "pm.test('Rôle restauré', () => pm.expect(pm.response.json().role).to.eql('EMPLOYEE'));",
      ],
    }),
    req({
      name: 'Règles de fraude (liste)',
      path: '/admin/fraud/rules',
      token: 'adminToken',
      tests: [
        "pm.test('Statut 200', () => pm.response.to.have.status(200));",
        'const rules = pm.response.json();',
        "pm.test('Règles configurables présentes', () => pm.expect(rules).to.be.an('array').and.not.empty);",
        V.set('ruleId', 'rules[0].id'),
        V.set('rulePoints', 'rules[0].points'),
      ],
    }),
    req({
      name: 'Règle · Ajuster le barème',
      method: 'PATCH',
      path: '/admin/fraud/rules/{{ruleId}}',
      token: 'adminToken',
      body: { points: 45 },
      tests: [
        "pm.test('Statut 200', () => pm.response.to.have.status(200));",
        "pm.test('Points mis à jour', () => pm.expect(Number(pm.response.json().points)).to.eql(45));",
      ],
    }),
    req({
      name: 'Règle · Restaurer le barème',
      method: 'PATCH',
      path: '/admin/fraud/rules/{{ruleId}}',
      token: 'adminToken',
      rawBody: '{\n  "points": {{rulePoints}}\n}',
      tests: [
        "pm.test('Statut 200 — barème restauré', () => pm.response.to.have.status(200));",
      ],
    }),
    req({
      name: 'Configuration système',
      path: '/admin/config',
      token: 'adminToken',
      tests: [
        "pm.test('Statut 200', () => pm.response.to.have.status(200));",
      ],
    }),
    req({
      name: 'Journal d’audit',
      path: '/admin/audit?limit=20',
      token: 'adminToken',
      tests: [
        "pm.test('Statut 200', () => pm.response.to.have.status(200));",
        'const logs = pm.response.json();',
        "pm.test('Événements d’audit présents', () => pm.expect(logs).to.be.an('array').and.not.empty);",
        "pm.test('La simulation de fraude est journalisée', () => pm.expect(logs.some((l) => l.action === 'FRAUD_SIMULATION')).to.eql(true));",
      ],
    }),
    req({
      name: 'Rapport système (30 jours)',
      path: '/admin/reports/summary?days=30',
      token: 'adminToken',
      tests: [
        "pm.test('Statut 200', () => pm.response.to.have.status(200));",
        "pm.test('Vue d’ensemble et séries quotidiennes', () => { const r = pm.response.json(); pm.expect(r.overview).to.be.an('object'); pm.expect(r.daily).to.be.an('array'); });",
      ],
    }),
    req({
      name: 'Export CSV · Toutes les transactions',
      path: '/admin/reports/transactions.csv',
      token: 'adminToken',
      tests: [
        "pm.test('Statut 200', () => pm.response.to.have.status(200));",
        "pm.test('Content-Type CSV', () => pm.expect(pm.response.headers.get('Content-Type')).to.include('text/csv'));",
        "pm.test('En-têtes de l’export', () => pm.expect(pm.response.text()).to.include('Date;Référence;Type;Compte source;Compte cible;Montant (XAF);Statut'));",
      ],
    }),
    req({
      name: 'Export CSV · Journal d’audit',
      path: '/admin/reports/audit.csv',
      token: 'adminToken',
      tests: [
        "pm.test('Statut 200', () => pm.response.to.have.status(200));",
        "pm.test('Content-Type CSV', () => pm.expect(pm.response.headers.get('Content-Type')).to.include('text/csv'));",
        "pm.test('En-têtes de l’export', () => pm.expect(pm.response.text()).to.include('Date;Utilisateur;Rôle;Action;Entité;Description;IP'));",
      ],
    }),
  ],
};

/* ------------------------------------------------------------------ */
/* 4 — Sécurité RBAC                                                   */
/* ------------------------------------------------------------------ */
const rbacFolder = {
  name: '4 · Sécurité RBAC (tests négatifs)',
  description: 'Chaque rôle est strictement cantonné à son espace : tout accès croisé est refusé (403), même en forçant l’URL.',
  item: [
    req({
      name: 'Client → /employee/dashboard (403)',
      path: '/employee/dashboard',
      token: 'clientToken',
      tests: ["pm.test('Accès refusé au client', () => pm.response.to.have.status(403));"],
    }),
    req({
      name: 'Client → /admin/dashboard (403)',
      path: '/admin/dashboard',
      token: 'clientToken',
      tests: ["pm.test('Accès refusé au client', () => pm.response.to.have.status(403));"],
    }),
    req({
      name: 'Client → export admin CSV (403)',
      path: '/admin/reports/transactions.csv',
      token: 'clientToken',
      tests: ["pm.test('L’export admin est protégé', () => pm.response.to.have.status(403));"],
    }),
    req({
      name: 'Employé → /admin/employees (403)',
      path: '/admin/employees',
      token: 'employeeToken',
      tests: ["pm.test('Accès refusé à l’employé', () => pm.response.to.have.status(403));"],
    }),
    req({
      name: 'Employé → /customer/dashboard (403)',
      path: '/customer/dashboard',
      token: 'employeeToken',
      tests: ["pm.test('Accès refusé à l’employé', () => pm.response.to.have.status(403));"],
    }),
    req({
      name: 'Sans jeton → /customer/dashboard (401)',
      path: '/customer/dashboard',
      tests: ["pm.test('Authentification requise', () => pm.response.to.have.status(401));"],
    }),
  ],
};

/* ------------------------------------------------------------------ */
const collection = {
  info: {
    _postman_id: 'shield-api-collection-v1',
    name: 'Shield — API Bancaire & Détection de Fraude',
    description:
      'Collection de tests complète de l’API Shield (NestJS, port 4000).\n\n' +
      'Ordre d’exécution : 0 · Authentification → 1 · Espace CLIENT → 2 · Espace EMPLOYÉ → 3 · Espace ADMIN → 4 · Sécurité RBAC.\n\n' +
      'Prérequis : API démarrée (`npm run start` dans backend/banking-api) sur {{baseUrl}}. Les jetons JWT sont stockés automatiquement en variables de collection. Exécution CLI : `npm run test:postman`.',
    schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
  },
  auth: { type: 'noauth' },
  variable: [
    { key: 'baseUrl', value: 'http://localhost:4000/api' },
    { key: 'adminToken', value: '' },
    { key: 'employeeToken', value: '' },
    { key: 'clientToken', value: '' },
    { key: 'myAccountId', value: '' },
    { key: 'demoAccountId', value: '' },
    { key: 'reviewTxId', value: '' },
    { key: 'reviewStatus', value: '' },
    { key: 'fundingTxId', value: '' },
    { key: 'fundingStatus', value: '' },
    { key: 'benefId', value: '' },
    { key: 'firstCustomerId', value: '' },
    { key: 'targetEmployeeId', value: '' },
    { key: 'ruleId', value: '' },
    { key: 'rulePoints', value: '' },
  ],
  item: [authFolder, customerFolder, employeeFolder, adminFolder, rbacFolder],
};

writeFileSync(
  new URL('./FinGuard-API.postman_collection.json', import.meta.url),
  JSON.stringify(collection, null, 2),
);
console.log('✅ Collection générée : postman/FinGuard-API.postman_collection.json');

/**
 * Tests E2E Shield — exécutés contre une API démarrée (PORT=4000 par défaut)
 * avec une base seedée (`npm run db:reset` puis `npm start`).
 *
 *   npm run test:e2e
 *
 * Couvre : authentification, RBAC, flux transactionnel complet (moteur de
 * fraude), limites de compte, bénéficiaires, relevés CSV, simulation de fraude.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

const BASE = process.env.API_URL || 'http://localhost:4000/api';

async function req(method, path, { token, body } = {}) {
  const res = await fetch(BASE + path, {
    method,
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data = null;
  try { data = JSON.parse(text); } catch { data = text; }
  return { status: res.status, data };
}

async function login(email, password) {
  const { status, data } = await req('POST', '/auth/login', { body: { email, password } });
  assert.equal(status, 201, `login de ${email} doit réussir`);
  return data.accessToken;
}

const uniq = () => Math.floor(Math.random() * 1e9);

test('authentification : login valide / invalide / /me', async () => {
  const ok = await req('POST', '/auth/login', { body: { email: 'client@demo.com', password: 'Client123!' } });
  assert.equal(ok.status, 201);
  assert.ok(ok.data.accessToken);

  const bad = await req('POST', '/auth/login', { body: { email: 'client@demo.com', password: 'wrong' } });
  assert.equal(bad.status, 401);

  const me = await req('GET', '/auth/me', { token: ok.data.accessToken });
  assert.equal(me.status, 200);
  assert.equal(me.data.role, 'CLIENT');
});

test('RBAC : les espaces /employee et /admin sont fermés au client', async () => {
  const client = await login('client@demo.com', 'Client123!');
  for (const path of ['/employee/dashboard', '/employee/transactions', '/admin/dashboard', '/admin/audit']) {
    const res = await req('GET', path, { token: client });
    assert.equal(res.status, 403, `client sur ${path} doit recevoir 403`);
  }
});

test('RBAC : les espaces /admin sont fermés à l’employé, /customer fermé à l’employé', async () => {
  const emp = await login('marie.kouassi@shield.com', 'Employe123!');
  assert.equal((await req('GET', '/admin/dashboard', { token: emp })).status, 403);
  assert.equal((await req('GET', '/customer/dashboard', { token: emp })).status, 403);

  const admin = await login('admin@shield.com', 'Admin123!');
  assert.equal((await req('GET', '/admin/dashboard', { token: admin })).status, 200);
});

test('flux : petit dépôt autorisé directement (risque faible)', async () => {
  const client = await login('client@demo.com', 'Client123!');
  const res = await req('POST', '/customer/transactions', {
    token: client,
    body: { type: 'DEPOSIT', amount: 25000, description: `Dépôt test ${uniq()}` },
  });
  assert.equal(res.status, 201);
  const tx = res.data.transaction ?? res.data;
  assert.equal(tx.status, 'COMPLETED');
  assert.ok(['LOW', 'MEDIUM'].includes(tx.riskLevel ?? res.data.analysis?.riskLevel ?? 'LOW'));
});

test('flux : gros virement mis en revue puis approuvé par l’employé', async () => {
  const client = await login('client@demo.com', 'Client123!');
  const emp = await login('marie.kouassi@shield.com', 'Employe123!');

  const accounts = (await req('GET', '/customer/accounts', { token: client })).data;
  const target = 'FG-10000102';
  assert.ok(accounts.length >= 1);
  const accountId = accounts[0].id;

  // L’administrateur relève les limites globales (rend le test rejouable).
  const admin = await login('admin@shield.com', 'Admin123!');
  const cfg = await req('POST', '/admin/config', {
    token: admin,
    body: { values: { GLOBAL_PER_TX_LIMIT: '50000000', GLOBAL_DAILY_LIMIT: '500000000' } },
  });
  assert.ok([200, 201].includes(cfg.status));

  // L’employé relève les limites du compte (idempotent, rend le test rejouable).
  const limits = await req('PATCH', `/employee/accounts/${accountId}`, {
    token: emp,
    body: { dailyLimit: 500000000, perTxLimit: 5000000 },
  });
  assert.equal(limits.status, 200);

  // Provisionne le compte pour rester indépendant des exécutions précédentes.
  const funding = await req('POST', '/customer/transactions', {
    token: client,
    body: { type: 'DEPOSIT', amount: 1500000, description: `Provisionnement test ${uniq()}` },
  });
  assert.equal(funding.status, 201);
  const fundingTx = funding.data.transaction ?? funding.data;
  if (fundingTx.status === 'PENDING' && fundingTx.requiresVerification) {
    // Le moteur demande une vérification client → le client confirme (flux §32).
    const confirmed = await req('POST', `/customer/transactions/${fundingTx.id}/confirm`, {
      token: client,
      body: { legitimate: true },
    });
    assert.equal(confirmed.status, 201);
  } else if (fundingTx.status === 'UNDER_REVIEW') {
    const approved = await req('POST', `/employee/transactions/${fundingTx.id}/approve`, {
      token: emp,
      body: { notes: 'Provisionnement test' },
    });
    assert.equal(approved.status, 201);
  }

  const created = await req('POST', '/customer/transactions', {
    token: client,
    body: { type: 'TRANSFER', amount: 2500000, targetAccountNumber: target, description: `Virement test ${uniq()}` },
  });
  assert.equal(created.status, 201);
  const tx = created.data.transaction ?? created.data;
  assert.ok(
    ['UNDER_REVIEW', 'PENDING'].includes(tx.status),
    `un gros virement ne doit pas passer directement (statut reçu : ${tx.status})`,
  );

  // Le détail employé inclut l'analyse et les transactions connexes.
  const detail = await req('GET', `/employee/transactions/${tx.id}`, { token: emp });
  assert.equal(detail.status, 200);
  assert.ok(detail.data.analysis, 'le détail doit inclure l’analyse de fraude');
  assert.ok(['MEDIUM', 'HIGH'].includes(detail.data.analysis.riskLevel));
  assert.ok(Array.isArray(detail.data.relatedTransactions));

  if (tx.status === 'UNDER_REVIEW') {
    // Risque élevé → revue employé (approbation), puis double-approbation refusée.
    const approved = await req('POST', `/employee/transactions/${tx.id}/approve`, { token: emp, body: { notes: 'Vérifié par test E2E' } });
    assert.equal(approved.status, 201);
    const twice = await req('POST', `/employee/transactions/${tx.id}/approve`, { token: emp, body: {} });
    assert.equal(twice.status, 400, 'une transaction déjà approuvée ne peut pas l’être deux fois');
  } else {
    // Risque moyen → vérification demandée au client, qui confirme.
    const confirmed = await req('POST', `/customer/transactions/${tx.id}/confirm`, { token: client, body: { legitimate: true } });
    assert.equal(confirmed.status, 201);
    const twice = await req('POST', `/customer/transactions/${tx.id}/confirm`, { token: client, body: { legitimate: true } });
    assert.equal(twice.status, 400, 'une transaction déjà confirmée ne peut pas l’être deux fois');
  }

  const finalDetail = await req('GET', `/employee/transactions/${tx.id}`, { token: emp });
  assert.equal(finalDetail.data.status, 'COMPLETED');
});

test('limites : un montant au-delà de la limite par transaction est rejeté', async () => {
  const client = await login('client@demo.com', 'Client123!');
  const res = await req('POST', '/customer/transactions', {
    token: client,
    body: { type: 'WITHDRAWAL', amount: 99999999 },
  });
  assert.equal(res.status, 400);
  assert.match(String(res.data.message), /limite/i);
});

test('bénéficiaires : ajout, refus de doublon, suppression', async () => {
  const client = await login('client@demo.com', 'Client123!');
  const accountNumber = `FG-TEST${uniq()}`;
  const added = await req('POST', '/customer/beneficiaries', {
    token: client,
    body: { name: `Test E2E ${uniq()}`, accountNumber },
  });
  assert.equal(added.status, 201);

  const dup = await req('POST', '/customer/beneficiaries', {
    token: client,
    body: { name: 'Doublon', accountNumber },
  });
  assert.equal(dup.status, 409);

  const del = await req('DELETE', `/customer/beneficiaries/${added.data.id}`, { token: client });
  assert.equal(del.status, 200);
});

test('relevé de compte : export CSV client et employé', async () => {
  const client = await login('client@demo.com', 'Client123!');
  const emp = await login('marie.kouassi@shield.com', 'Employe123!');
  const accounts = (await req('GET', '/customer/accounts', { token: client })).data;
  const accountId = accounts[0].id;

  const resClient = await fetch(`${BASE}/customer/accounts/${accountId}/statement`, { headers: { Authorization: `Bearer ${client}` } });
  assert.equal(resClient.status, 200);
  const csv = await resClient.text();
  assert.match(csv, /Date;Référence;Type/);

  const resEmp = await fetch(`${BASE}/employee/accounts/${accountId}/statement`, { headers: { Authorization: `Bearer ${emp}` } });
  assert.equal(resEmp.status, 200);

  // Un autre client ne peut pas télécharger le relevé.
  const other = await login('amina.ndong@demo.com', 'Client123!');
  const resOther = await fetch(`${BASE}/customer/accounts/${accountId}/statement`, { headers: { Authorization: `Bearer ${other}` } });
  assert.equal(resOther.status, 404);
});

test('simulation de fraude : aucun mouvement de fonds, analyse retournée', async () => {
  const emp = await login('marie.kouassi@shield.com', 'Employe123!');
  const client = await login('client@demo.com', 'Client123!');
  const accounts = (await req('GET', '/customer/accounts', { token: client })).data;
  const before = accounts[0].balance;

  const sim = await req('POST', '/employee/transactions/simulate', {
    token: emp,
    body: { accountId: accounts[0].id, type: 'TRANSFER', amount: 4500000 },
  });
  assert.equal(sim.status, 201);
  assert.ok(sim.data.simulation);
  assert.ok(['LOW', 'MEDIUM', 'HIGH'].includes(sim.data.analysis.riskLevel));

  const after = (await req('GET', '/customer/accounts', { token: client })).data;
  assert.equal(after[0].balance, before, 'la simulation ne doit pas débiter le compte');
});

test('administration : attribution de rôle (aller-retour)', async () => {
  const admin = await login('admin@shield.com', 'Admin123!');
  const employees = (await req('GET', '/admin/employees', { token: admin })).data;
  const target = employees.find((e) => e.role === 'EMPLOYEE');
  assert.ok(target, 'au moins un employé doit exister');

  assert.equal((await req('PATCH', `/admin/employees/${target.id}`, { token: admin, body: { role: 'ADMIN' } })).status, 200);
  let roles = (await req('GET', '/admin/employees', { token: admin })).data.find((e) => e.id === target.id).role;
  assert.equal(roles, 'ADMIN');

  assert.equal((await req('PATCH', `/admin/employees/${target.id}`, { token: admin, body: { role: 'EMPLOYEE' } })).status, 200);
  roles = (await req('GET', '/admin/employees', { token: admin })).data.find((e) => e.id === target.id).role;
  assert.equal(roles, 'EMPLOYEE');
});

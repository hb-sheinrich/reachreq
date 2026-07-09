import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp } from '../app.js';
import { prisma } from '../lib/prisma.js';
import { signToken } from '../lib/jwt.js';
import type { FastifyInstance } from 'fastify';

let app: FastifyInstance;
const adminToken = signToken({ sub: 'test-admin', email: 'admin@haiberg.com', name: 'Test Admin', isAdmin: true });
const userToken = signToken({ sub: 'test-user', email: 'user@haiberg.com', name: 'Test User', isAdmin: false });

async function createModule() {
  const code = `LOG${Math.random().toString(36).slice(2, 8)}`.toUpperCase();
  const res = await app.inject({
    method: 'POST',
    url: '/api/modules',
    headers: { authorization: `Bearer ${adminToken}` },
    payload: { name: `Logistik ${code}`, code, description: 'Test' },
  });
  if (res.statusCode !== 200) {
    console.error('createModule failed', res.payload);
  }
  return JSON.parse(res.payload).module;
}

async function createRequirement(moduleId: string, token: string = userToken) {
  const res = await app.inject({
    method: 'POST',
    url: '/api/requirements',
    headers: { authorization: `Bearer ${token}` },
    payload: {
      moduleId,
      title: 'Test-Anforderung',
      description: 'Beschreibung',
      classification: 'MUST_HAVE',
      status: 'DRAFT',
    },
  });
  return JSON.parse(res.payload).requirement;
}

describe('requirements', () => {
  beforeAll(async () => {
    app = await buildApp();
    await prisma.user.createMany({
      data: [
        { id: 'test-admin', email: 'admin@haiberg.com', name: 'Test Admin', role: 'ADMIN' },
        { id: 'test-user', email: 'user@haiberg.com', name: 'Test User', role: 'CONTRIBUTOR' },
      ],
      skipDuplicates: true,
    });
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('creates and lists requirements', async () => {
    const module = await createModule();
    const requirement = await createRequirement(module.id);
    expect(requirement.title).toBe('Test-Anforderung');
    expect(requirement.humanReadableId).toMatch(/^MOD-LOG/);

    const list = await app.inject({
      method: 'GET',
      url: '/api/requirements',
      headers: { authorization: `Bearer ${userToken}` },
    });
    const data = JSON.parse(list.payload);
    expect(data.requirements.length).toBeGreaterThan(0);
  });

  it('detects optimistic locking conflicts', async () => {
    const module = await createModule();
    const req = await createRequirement(module.id);

    const res = await app.inject({
      method: 'PATCH',
      url: `/api/requirements/${req.id}`,
      headers: { authorization: `Bearer ${userToken}` },
      payload: { title: 'Aktualisierter Titel', editVersion: 999 },
    });
    expect(res.statusCode).toBe(409);
  });

  it('submits a version and only admin can approve', async () => {
    const module = await createModule();
    const req = await createRequirement(module.id);

    const submit = await app.inject({
      method: 'POST',
      url: `/api/requirements/${req.id}/submit`,
      headers: { authorization: `Bearer ${userToken}` },
      payload: {},
    });
    expect(submit.statusCode).toBe(200);
    const afterSubmit = JSON.parse(submit.payload).requirement;
    expect(afterSubmit.status).toBe('SUBMITTED_FOR_RELEASE');
    expect(afterSubmit.currentVersion).toBeTruthy();

    const approveUser = await app.inject({
      method: 'POST',
      url: `/api/requirements/${req.id}/approve`,
      headers: { authorization: `Bearer ${userToken}` },
      payload: {},
    });
    expect(approveUser.statusCode).toBe(403);

    const approveAdmin = await app.inject({
      method: 'POST',
      url: `/api/requirements/${req.id}/approve`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {},
    });
    expect(approveAdmin.statusCode).toBe(200);
    const approved = JSON.parse(approveAdmin.payload).requirement;
    expect(approved.status).toBe('APPROVED');
    expect(approved.frozenById).toBe('test-admin');
  });

  it('creates a version on submit and rollback restores it', async () => {
    const module = await createModule();
    const req = await createRequirement(module.id);

    await app.inject({
      method: 'POST',
      url: `/api/requirements/${req.id}/submit`,
      headers: { authorization: `Bearer ${userToken}` },
      payload: {},
    });

    const versions = await app.inject({
      method: 'GET',
      url: `/api/requirements/${req.id}/versions`,
      headers: { authorization: `Bearer ${userToken}` },
    });
    const versionList = JSON.parse(versions.payload).versions;
    expect(versionList.length).toBeGreaterThan(0);

    const rollback = await app.inject({
      method: 'POST',
      url: `/api/requirements/${req.id}/rollback`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { versionId: versionList[0].id },
    });
    expect(rollback.statusCode).toBe(200);
    const afterRollback = JSON.parse(rollback.payload).requirement;
    expect(afterRollback.status).toBe('DRAFT');
  });

  it('frozen requirement cannot be edited', async () => {
    const module = await createModule();
    const req = await createRequirement(module.id);

    await app.inject({
      method: 'POST',
      url: `/api/requirements/${req.id}/submit`,
      headers: { authorization: `Bearer ${userToken}` },
      payload: {},
    });
    await app.inject({
      method: 'POST',
      url: `/api/requirements/${req.id}/approve`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {},
    });

    const edit = await app.inject({
      method: 'PATCH',
      url: `/api/requirements/${req.id}`,
      headers: { authorization: `Bearer ${userToken}` },
      payload: { title: 'Versuch', editVersion: 1 },
    });
    expect(edit.statusCode).toBe(403);
  });
});

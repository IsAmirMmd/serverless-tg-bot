// The Mini App's endpoints: admin-only, paginated, searchable.

import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { fresh, msg, ctxOf, ADMIN_ID } from './helpers.mjs';
import message from '../tgcloud/handlers/message.js';
import adminStats from '../tgcloud/endpoints/adminStats.js';
import adminUsers from '../tgcloud/endpoints/adminUsers.js';

beforeEach(fresh);

const startAll = (ids) => Promise.all(ids.map((id) => message(msg(id, '/start'), {})));

test('adminStats and adminUsers refuse everyone but the admin', async () => {
  for (const endpoint of [adminStats, adminUsers]) {
    await assert.rejects(endpoint({}, ctxOf(ADMIN_ID + 1)), (e) => e.parameters?.code === 'FORBIDDEN');
  }
});

test('adminStats counts users', async () => {
  await startAll([11, 12, 13]);
  const s = await adminStats({}, ctxOf(ADMIN_ID));
  assert.equal(s.users, 3);
  assert.equal(s.started, 3);
  assert.equal(s.new_7d, 3);
});

test('adminUsers pages, clamps and searches', async () => {
  await startAll(Array.from({ length: 12 }, (_, i) => 100 + i));
  const p1 = await adminUsers({ page: 1, size: 5 }, ctxOf(ADMIN_ID));
  assert.equal(p1.total, 12);
  assert.equal(p1.pages, 3);
  assert.equal(p1.rows.length, 5);
  assert.equal(typeof p1.rows[0].blocked, 'boolean');

  const clamped = await adminUsers({ page: -3, size: 10_000 }, ctxOf(ADMIN_ID));
  assert.equal(clamped.page, 1);
  assert.equal(clamped.size, 100);

  const found = await adminUsers({ q: '105' }, ctxOf(ADMIN_ID));
  assert.deepEqual(found.rows.map((r) => r.user_id), [105]);
});

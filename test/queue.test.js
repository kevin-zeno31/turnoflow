import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { openStore } from '../store.js';
import { createApp } from '../server.js';

test('FIFO, reintentos, transiciones y persistencia después de reiniciar', () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'turnoflow-test-'));
  let store = openStore(path.join(directory, 'test.sqlite'));
  try {
    const first = store.create('request-0000000001');
    const second = store.create('request-0000000002');
    assert.equal(store.create('request-0000000001').id, first.id);
    assert.equal(store.snapshot().waitingCount, 2);
    assert.equal(store.callNext().id, first.id);
    assert.throws(() => store.callNext(), /Finaliza/);
    assert.throws(() => store.finish(second.id), /ya no/);
    store.finish(first.id);
    assert.throws(() => store.finish(first.id), /ya no/);
    store.close(); store = openStore(path.join(directory, 'test.sqlite'));
    assert.equal(store.snapshot().doneCount, 1);
    assert.equal(store.callNext().id, second.id);
    store.finish(second.id);
    assert.throws(() => store.callNext(), /No hay/);
  } finally { store.close(); rmSync(directory, { recursive:true, force:true }); }
});

test('API: llamadas concurrentes, validaciones y aislamiento local', async () => {
  const store = openStore(':memory:');
  const server = createApp(store);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const post = (route, body, extra = {}) => fetch(origin + route, { method:'POST', headers:{'Content-Type':'application/json',...extra}, body:JSON.stringify(body) });
  try {
    assert.equal((await fetch(origin)).status, 200);
    assert.equal((await post('/api/tickets', {requestKey:'request-0000000001'})).status, 201);
    assert.equal((await post('/api/tickets', {requestKey:'request-0000000002'})).status, 201);
    const calls = await Promise.all([post('/api/call', {}), post('/api/call', {})]);
    assert.deepEqual(calls.map(r => r.status).sort(), [200,409]);
    const current = await (await fetch(origin+'/api/queue')).json();
    assert.equal(current.active.code, 'A-001'); assert.equal(current.waitingCount, 1);
    assert.equal((await post('/api/tickets', {requestKey:'short'})).status, 400);
    assert.equal((await post('/api/tickets', null)).status, 400);
    assert.equal((await post('/api/finish', {id:'1'})).status, 400);
    assert.equal((await post('/api/finish', {id:current.active.id}, {Origin:'https://another-site.example'})).status, 403);
    assert.equal((await post('/api/finish', {id:current.active.id})).status, 200);
    assert.equal((await fetch(origin+'/server.js')).status, 404);
    assert.equal((await fetch(origin+'/data/turnoflow.sqlite')).status, 404);
  } finally { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); store.close(); }
});

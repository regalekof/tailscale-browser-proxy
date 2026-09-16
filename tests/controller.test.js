import test from 'node:test';
import assert from 'node:assert/strict';
import { createController } from '../extension/controller.js';
import { proxyConfig } from '../extension/model.js';

const profile = { id: 'home', name: 'Home', host: '100.80.12.34', port: 1080, scheme: 'socks5' };
function fixture(fetcher) {
  let current = { value: { mode: 'system' }, levelOfControl: 'controllable_by_this_extension' };
  let saved = [structuredClone(profile)];
  const calls = [];
  const api = {
    proxy: { settings: {
      get: async () => structuredClone(current),
      set: async details => { calls.push(['set', details]); current = { value: details.value, levelOfControl: 'controlled_by_this_extension' }; },
      clear: async details => { calls.push(['clear', details]); current = { value: { mode: 'system' }, levelOfControl: 'controllable_by_this_extension' }; }
    } },
    storage: { local: {
      get: async () => ({ profiles: structuredClone(saved) }),
      set: async data => { saved = structuredClone(data.profiles); }
    } },
    permissions: { contains: async () => true }
  };
  let count = 0;
  return { api, calls, setCurrent: value => { current = value; },
    dispatch: createController(api, fetcher ?? (async () => ({ ok: true, json: async () => ({ ip: '203.0.113.10' }) })), () => `id-${++count}`) };
}

test('saving and reading profiles do not change network settings', async () => {
  const f = fixture();
  const result = await f.dispatch({ action: 'add', profile: { ...profile, name: 'Work', host: '100.80.12.35' } });
  assert.equal(result.profiles.length, 2); assert.deepEqual(f.calls, []);
});
test('switches only regular profile and derives active status from effective settings', async () => {
  const f = fixture(); const result = await f.dispatch({ action: 'activate', id: 'home' });
  assert.equal(result.activeId, 'home'); assert.equal(f.calls[0][1].scope, 'regular_only');
  f.setCurrent({ value: { mode: 'direct' }, levelOfControl: 'controlled_by_other_extensions' });
  assert.equal((await f.dispatch({ action: 'state' })).activeId, null);
});
test('does not claim a matching proxy owned by another extension', async () => {
  const f = fixture(); f.setCurrent({ value: proxyConfig(profile), levelOfControl: 'controlled_by_other_extensions' });
  assert.equal((await f.dispatch({ action: 'state' })).owned, false);
});
test('rejects policy and extension conflicts before mutation', async () => {
  for (const levelOfControl of ['not_controllable', 'controlled_by_other_extensions']) {
    const f = fixture(); f.setCurrent({ value: { mode: 'system' }, levelOfControl });
    await assert.rejects(f.dispatch({ action: 'activate', id: 'home' }), /controlled/); assert.deepEqual(f.calls, []);
  }
});
test('detects a browser setting that failed to take effect', async () => {
  const f = fixture(); f.api.proxy.settings.set = async () => {};
  await assert.rejects(f.dispatch({ action: 'activate', id: 'home' }), /did not keep/);
});
test('restores by clearing the override, not by forcing a direct connection', async () => {
  const f = fixture(); await f.dispatch({ action: 'activate', id: 'home' });
  const result = await f.dispatch({ action: 'restore' });
  assert.deepEqual(f.calls[1], ['clear', { scope: 'regular_only' }]); assert.equal(result.owned, false);
});
test('can remove its dormant override while policy controls the effective setting', async () => {
  const f = fixture(); f.setCurrent({ value: { mode: 'system' }, levelOfControl: 'not_controllable' });
  await f.dispatch({ action: 'restore' }); assert.equal(f.calls[0][0], 'clear');
});
test('reports a failed restore', async () => {
  const f = fixture(); await f.dispatch({ action: 'activate', id: 'home' }); f.api.proxy.settings.clear = async () => {};
  await assert.rejects(f.dispatch({ action: 'restore' }), /still reports/);
});
test('requires switching away before deleting an active profile', async () => {
  const f = fixture(); await f.dispatch({ action: 'activate', id: 'home' });
  await assert.rejects(f.dispatch({ action: 'remove', id: 'home' }), /before removing/);
  await f.dispatch({ action: 'restore' }); assert.equal((await f.dispatch({ action: 'remove', id: 'home' })).profiles.length, 0);
});
test('rejects missing profile IDs and unknown messages', async () => {
  const f = fixture();
  for (const action of ['activate', 'remove']) await assert.rejects(f.dispatch({ action, id: 'missing' }), /not found/);
  await assert.rejects(f.dispatch({ action: 'shell' }), /Unknown/);
});
test('rejects duplicate labels and duplicate proxy endpoints', async () => {
  const f = fixture();
  await assert.rejects(f.dispatch({ action: 'add', profile: { ...profile, name: 'HOME', host: '100.80.1.2' } }), /name/);
  await assert.rejects(f.dispatch({ action: 'add', profile: { ...profile, name: 'Different' } }), /already saved/);
});
test('serializes simultaneous edits without lost updates', async () => {
  const f = fixture();
  await Promise.all(['2', '3', '4'].map(n => f.dispatch({ action: 'add', profile: { ...profile, name: n, host: `100.80.1.${n}` } })));
  assert.equal((await f.dispatch({ action: 'state' })).profiles.length, 4);
});
test('restoring after a slow activation cannot be overwritten by that activation', async () => {
  const f = fixture(); const original = f.api.proxy.settings.set;
  f.api.proxy.settings.set = async details => { await new Promise(resolve => setTimeout(resolve, 20)); return original(details); };
  await Promise.all([f.dispatch({ action: 'activate', id: 'home' }), f.dispatch({ action: 'restore' })]);
  assert.equal((await f.dispatch({ action: 'state' })).owned, false);
});
test('a failed command does not poison subsequent commands', async () => {
  const f = fixture(); await assert.rejects(f.dispatch({ action: 'activate', id: 'missing' }));
  assert.equal((await f.dispatch({ action: 'activate', id: 'home' })).activeId, 'home');
});
test('optional IP check sends no credentials and does not change proxy settings', async () => {
  let request;
  const f = fixture(async (url, options) => { request = { url, options }; return { ok: true, json: async () => ({ ip: '203.0.113.10' }) }; });
  assert.equal((await f.dispatch({ action: 'check' })).ip, '203.0.113.10');
  assert.equal(request.options.credentials, 'omit'); assert.equal(request.options.cache, 'no-store'); assert.deepEqual(f.calls, []);
});
test('does not contact the IP service without permission', async () => {
  let contacted = false; const f = fixture(async () => { contacted = true; }); f.api.permissions.contains = async () => false;
  await assert.rejects(f.dispatch({ action: 'check' }), /permission/); assert.equal(contacted, false);
});
test('rejects bad IP responses and HTTP errors', async () => {
  for (const response of [{ ok: false, status: 503 }, { ok: true, json: async () => ({ ip: 'bad' }) }]) {
    await assert.rejects(fixture(async () => response).dispatch({ action: 'check' }));
  }
});
test('does not report an IP measured across a proxy configuration change', async () => {
  const f = fixture(async () => {
    f.setCurrent({ value: { mode: 'direct' }, levelOfControl: 'not_controllable' });
    return { ok: true, json: async () => ({ ip: '203.0.113.10' }) };
  });
  await assert.rejects(f.dispatch({ action: 'check' }), /changed during/);
});
test('connectivity failure leaves the selected proxy in place', async () => {
  const f = fixture(async () => { throw new Error('Network unavailable'); });
  await f.dispatch({ action: 'activate', id: 'home' }); await assert.rejects(f.dispatch({ action: 'check' }), /Network unavailable/);
  assert.equal((await f.dispatch({ action: 'state' })).activeId, 'home');
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { isIPv4, normalizeHost, proxyConfig, validateProfile } from '../extension/model.js';

const base = { name: 'Home', host: '100.80.12.34', port: 1080, scheme: 'socks5' };
test('accepts Tailscale IPv4 boundaries and local SSH tunnel addresses', () => {
  for (const host of ['100.64.0.0', '100.127.255.255', '127.0.0.1', 'localhost', '[::1]']) assert.equal(normalizeHost(host), host);
  assert.equal(normalizeHost('::1'), '[::1]');
});
test('normalizes a full MagicDNS name', () => assert.equal(normalizeHost(' Home.Example.ts.net '), 'home.example.ts.net'));
test('rejects public IPs, URLs, credentials, malformed IPs and host injection', () => {
  for (const host of ['100.63.0.1', '100.128.0.1', '100.80.999.1', '1.2.3.4', '0100.80.0.1', 'http://100.80.0.1', 'a@100.80.0.1', 'a.ts.net/path', '-a.ts.net', 'a.ts.net\n.example', '']) {
    assert.throws(() => normalizeHost(host));
  }
});
test('rejects invalid ports and unsupported protocols', () => {
  for (const port of [0, 65536, -1, 2.5, '1e3', '80x', null]) assert.throws(() => validateProfile({ ...base, port }));
  assert.throws(() => validateProfile({ ...base, scheme: 'file' }));
});
test('trims names and strips unrecognized fields', () => {
  assert.deepEqual(validateProfile({ ...base, name: ' Home ', port: '1080', password: 'never-store', id: 'injected' }), base);
});
test('validates names', () => {
  for (const name of ['', ' ', 'x'.repeat(61), 'a\nb']) assert.throws(() => validateProfile({ ...base, name }));
});
test('builds explicit proxy settings without adding a direct fallback or custom bypass', () => {
  assert.deepEqual(proxyConfig(base), { mode: 'fixed_servers', rules: { singleProxy: { scheme: 'socks5', host: base.host, port: 1080 } } });
});
test('validates the public IPv4 service response', () => {
  assert.equal(isIPv4('203.0.113.10'), true);
  for (const value of [undefined, '999.1.1.1', '<script>', '1.2.3', '01.2.3.4']) assert.equal(isIPv4(value), false);
});

export const SCOPE = 'regular_only';
export const IP_ORIGIN = 'https://api.ipify.org/*';

export function isIPv4(value) {
  return typeof value === 'string' && /^(0|[1-9]\d{0,2})(\.(0|[1-9]\d{0,2})){3}$/.test(value)
    && value.split('.').every(part => Number(part) <= 255);
}

export function normalizeHost(value) {
  if (typeof value !== 'string') throw new Error('Enter a proxy address.');
  const host = value.trim().toLowerCase();
  if (['localhost', '127.0.0.1', '::1', '[::1]'].includes(host)) return host === '::1' ? '[::1]' : host;
  if (isIPv4(host)) {
    const [first, second] = host.split('.').map(Number);
    if (first === 100 && second >= 64 && second <= 127) return host;
  }
  if (host.length <= 253 && host.endsWith('.ts.net') && host.split('.').every(label =>
    /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label))) return host;
  throw new Error('Use a Tailscale IPv4 address (100.64–100.127.x.x), a .ts.net name, or localhost for an SSH tunnel.');
}

export function validateProfile(input) {
  if (!input || typeof input !== 'object') throw new Error('Invalid proxy profile.');
  const name = typeof input.name === 'string' ? input.name.trim() : '';
  if (!name || name.length > 60 || /[\x00-\x1f\x7f]/.test(name)) throw new Error('Use a name of 1–60 characters.');
  if (!['http', 'socks5'].includes(input.scheme)) throw new Error('Choose HTTP or SOCKS5.');
  if (!/^\d{1,5}$/.test(String(input.port))) throw new Error('Enter a port from 1 to 65535.');
  const port = Number(input.port);
  if (port < 1 || port > 65535) throw new Error('Enter a port from 1 to 65535.');
  return { name, scheme: input.scheme, host: normalizeHost(input.host), port };
}

export function proxyConfig(profile) {
  const { scheme, host, port } = validateProfile(profile);
  return { mode: 'fixed_servers', rules: { singleProxy: { scheme, host, port } } };
}

export function matchesProfile(config, profile) {
  if (config?.mode !== 'fixed_servers' || !config.rules?.singleProxy) return false;
  const actual = config.rules.singleProxy;
  return actual.scheme === profile.scheme && actual.host === profile.host && actual.port === profile.port
    && !(config.rules.bypassList?.length);
}

export function requireControl(settings) {
  if (!['controllable_by_this_extension', 'controlled_by_this_extension'].includes(settings.levelOfControl)) {
    throw new Error('Proxy settings are controlled by a policy or another extension.');
  }
}

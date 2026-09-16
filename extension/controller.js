import { IP_ORIGIN, SCOPE, isIPv4, matchesProfile, proxyConfig, requireControl, validateProfile } from './model.js';

export function createController(api, fetcher = fetch, newId = () => crypto.randomUUID()) {
  let queue = Promise.resolve();
  const settings = () => api.proxy.settings.get({ incognito: false });
  const profiles = async () => (await api.storage.local.get({ profiles: [] })).profiles;

  async function state() {
    const [items, current] = await Promise.all([profiles(), settings()]);
    const owned = current.levelOfControl === 'controlled_by_this_extension';
    const active = owned ? items.find(item => matchesProfile(current.value, item)) : null;
    return { profiles: items, owned, activeId: active?.id ?? null, mode: current.value.mode, control: current.levelOfControl };
  }

  async function handle(message) {
    if (!message || typeof message.action !== 'string') throw new Error('Invalid request.');
    if (message.action === 'state') return state();
    if (message.action === 'add') {
      const profile = validateProfile(message.profile);
      const items = await profiles();
      if (items.length >= 30) throw new Error('You can save up to 30 proxies.');
      if (items.some(item => item.name.toLowerCase() === profile.name.toLowerCase())) throw new Error('That name is already in use.');
      if (items.some(item => item.scheme === profile.scheme && item.host === profile.host && item.port === profile.port)) {
        throw new Error('That proxy address is already saved.');
      }
      await api.storage.local.set({ profiles: [...items, { ...profile, id: newId() }] });
      return state();
    }
    if (message.action === 'remove') {
      const items = await profiles();
      const selected = items.find(item => item.id === message.id);
      if (!selected) throw new Error('Proxy profile not found.');
      const current = await settings();
      if (current.levelOfControl === 'controlled_by_this_extension' && matchesProfile(current.value, selected)) {
        throw new Error('Restore browser defaults or switch proxies before removing the active profile.');
      }
      await api.storage.local.set({ profiles: items.filter(item => item.id !== message.id) });
      return state();
    }
    if (message.action === 'activate') {
      const selected = (await profiles()).find(item => item.id === message.id);
      if (!selected) throw new Error('Proxy profile not found.');
      requireControl(await settings());
      await api.proxy.settings.set({ value: proxyConfig(selected), scope: SCOPE });
      const actual = await settings();
      if (actual.levelOfControl !== 'controlled_by_this_extension' || !matchesProfile(actual.value, selected)) {
        throw new Error('The browser did not keep the requested proxy settings. Refresh to inspect the current state.');
      }
      return state();
    }
    if (message.action === 'restore') {
      // Release only this extension's override, including one hidden by a higher-priority policy.
      // Never copy the old effective config or force direct mode over another owner's settings.
      await api.proxy.settings.clear({ scope: SCOPE });
      const actual = await settings();
      if (actual.levelOfControl === 'controlled_by_this_extension') throw new Error('The browser still reports this extension controls the proxy.');
      return state();
    }
    if (message.action === 'check') {
      if (!await api.permissions.contains({ origins: [IP_ORIGIN] })) throw new Error('Allow the IP check permission first.');
      const before = await settings();
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 10000);
      try {
        const response = await fetcher('https://api.ipify.org?format=json', {
          signal: controller.signal, cache: 'no-store', credentials: 'omit', redirect: 'error'
        });
        if (!response.ok) throw new Error(`IP check returned HTTP ${response.status}.`);
        const result = await response.json();
        if (!isIPv4(result.ip)) throw new Error('IP service returned an unexpected response.');
        const after = await settings();
        if (JSON.stringify(before) !== JSON.stringify(after)) throw new Error('Proxy settings changed during the check. Please check again.');
        return { ip: result.ip, checkedAt: new Date().toISOString() };
      } catch (error) {
        if (controller.signal.aborted) throw new Error('IP check timed out. The proxy setting is still applied; check your tunnel or restore defaults.');
        throw error;
      } finally { clearTimeout(timer); }
    }
    throw new Error('Unknown action.');
  }

  // A popup can close while a request runs. Keep mutations in the worker and serialize them.
  return message => {
    const task = queue.then(() => handle(message));
    queue = task.catch(() => {});
    return task;
  };
}

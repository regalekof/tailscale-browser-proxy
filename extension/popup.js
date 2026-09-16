import { IP_ORIGIN } from './model.js';

const $ = selector => document.querySelector(selector);
let busy = false;
async function send(action, extra = {}) {
  const result = await chrome.runtime.sendMessage({ action, ...extra });
  if (!result?.ok) throw new Error(result?.error || 'The extension worker did not respond. Reopen the popup.');
  return result.data;
}
function notice(text, error = false) { $('#notice').textContent = text; $('#notice').classList.toggle('error', error); }
function render(state) {
  const active = state.profiles.find(item => item.id === state.activeId);
  const blocked = ['not_controllable', 'controlled_by_other_extensions'].includes(state.control);
  $('#connection-title').textContent = blocked ? 'Managed elsewhere' : active ? active.name : state.owned ? 'Proxy override active' : 'Browser defaults';
  $('#connection-detail').textContent = blocked ? 'A policy or another extension controls this browser’s proxy.' : state.owned
    ? 'Proxy settings applied. Check the public IP to test connectivity.' : `No override from this extension. Effective mode: ${state.mode}.`;
  const list = $('#profiles');
  list.replaceChildren();
  if (!state.profiles.length) {
    const empty = document.createElement('p'); empty.className = 'empty';
    empty.textContent = 'Save your first proxy below. Saving does not change your connection.'; list.append(empty);
  }
  for (const profile of state.profiles) {
    const card = document.createElement('article'); card.className = `profile${profile.id === state.activeId ? ' active' : ''}`;
    const title = document.createElement('strong'); title.textContent = profile.name;
    const address = document.createElement('p'); address.textContent = `${profile.scheme}://${profile.host}:${profile.port}`;
    const buttons = document.createElement('div'); buttons.className = 'actions';
    const use = document.createElement('button'); use.textContent = profile.id === state.activeId ? 'Applied' : 'Use proxy';
    use.dataset.locked = String(blocked || profile.id === state.activeId);
    use.disabled = busy || use.dataset.locked === 'true';
    use.onclick = () => run(async () => {
      render(await send('activate', { id: profile.id }));
      $('#ip-result').textContent = 'Connection changed. Check the public IPv4 again.';
      notice('Proxy settings applied. Connectivity has not yet been checked.');
    });
    const remove = document.createElement('button'); remove.className = 'text-button'; remove.textContent = 'Remove';
    remove.dataset.locked = String(profile.id === state.activeId); remove.disabled = busy || remove.dataset.locked === 'true';
    remove.onclick = () => run(async () => { render(await send('remove', { id: profile.id })); notice('Proxy removed.'); });
    buttons.append(use, remove); card.append(title, address, buttons); list.append(card);
  }
}
async function run(task) {
  if (busy) return;
  busy = true;
  document.querySelectorAll('button').forEach(button => { button.disabled = true; });
  notice('Working…');
  try { await task(); } catch (error) { notice(error.message, true); }
  finally {
    busy = false;
    document.querySelectorAll('button').forEach(button => { button.disabled = button.dataset.locked === 'true'; });
  }
}
$('#add-form').onsubmit = event => {
  event.preventDefault();
  const profile = Object.fromEntries(new FormData(event.currentTarget));
  run(async () => { render(await send('add', { profile })); $('#add-form').reset(); $('#add-panel').open = false; notice('Proxy saved. Select Use proxy when ready.'); });
};
$('#restore').onclick = () => run(async () => {
  render(await send('restore')); $('#ip-result').textContent = 'Settings restored. Check again for the current public IPv4.';
  notice('Extension override removed. The browser’s underlying settings now apply.');
});
$('#refresh').onclick = () => run(async () => { render(await send('state')); notice('Settings refreshed.'); });
$('#check').onclick = () => {
  // Request directly inside the user gesture, before any other asynchronous work.
  const permission = chrome.permissions.request({ origins: [IP_ORIGIN] });
  run(async () => {
    if (!await permission) throw new Error('IP check permission was not granted. Proxy settings were not changed.');
    const result = await send('check');
    $('#ip-result').textContent = `Observed IPv4: ${result.ip} · ${new Date(result.checkedAt).toLocaleTimeString()}`;
    notice('This is the address seen by ipify. It does not test WebRTC, DNS, or every tab.');
  });
};
run(async () => { render(await send('state')); notice(''); });

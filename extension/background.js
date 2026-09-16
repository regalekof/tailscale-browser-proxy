import { createController } from './controller.js';

const dispatch = createController(chrome);
chrome.runtime.onMessage.addListener((message, sender, respond) => {
  if (sender.id !== chrome.runtime.id || sender.url !== chrome.runtime.getURL('popup.html')) return false;
  dispatch(message).then(data => respond({ ok: true, data }), error => respond({ ok: false, error: error.message }));
  return true;
});

# Privacy

The extension stores proxy profile names, protocols, addresses, ports, and generated IDs in `chrome.storage.local` on your device. It does not use browser sync, collect page content, read browsing history, inject content scripts, or include analytics.

Proxy settings are stored and applied by the browser. Traffic routed through a proxy is visible to the proxy operator to the extent allowed by the traffic's encryption. Use devices and proxies you trust.

**Check public IPv4** is optional. Clicking it requests permission for `https://api.ipify.org/*` and then sends an HTTPS request to `https://api.ipify.org?format=json`. ipify receives the connection's public IP and normal request metadata. No proxy names, saved endpoint list, browser history, or credentials are deliberately sent. Requests omit credentials and disable caching. Public-IP results are displayed in the popup and not saved to extension storage. There are no automatic checks.

`proxy` permission is used to read, apply, and clear this extension's browser proxy override. `storage` is used for saved profiles. No Tailscale API token or account login is required by the extension.

Removing a profile deletes it from extension storage. Browser extension removal deletes the extension's local data according to the browser's lifecycle. Restoring browser defaults releases its proxy override; it does not erase saved profiles.

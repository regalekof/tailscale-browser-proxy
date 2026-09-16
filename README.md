# Tailscale Browser Proxy

A Manifest V3 extension for switching **Chrome or Edge web requests** between HTTP/SOCKS5 proxies reachable through Tailscale. Designed for browser-only routing: it does not run `tailscale set`, change an exit node, or modify operating-system network settings.

**A Tailscale device is not automatically a proxy.** Supply an existing proxy endpoint, or create a local SOCKS5 tunnel over SSH to a device on your tailnet. The browser uses that device's outbound connection. Different devices on the same internet connection may show the same public IP.

Independent community project; not affiliated with or endorsed by Tailscale.

## What it does

- Save named endpoints locally and explicitly choose one.
- Use HTTP or SOCKS5, with a Tailscale IPv4 address, full `.ts.net` hostname, or local SSH tunnel address.
- Read the effective browser setting instead of trusting a saved “connected” flag.
- Detect policy/extension conflicts and verify that a requested setting took effect.
- Serialize changes so rapid requests cannot overwrite a later restore.
- Release its own proxy override with **Restore browser defaults**.
- Optionally check public IPv4 through ipify, after a permission prompt.

No automatic rotation, content scripts, website selectors, background IP polling, login collection, or bundled proxy servers. No backend, Node runtime, or native helper is required to use the extension.

## Install locally

1. Download/extract this repository.
2. Open `chrome://extensions` or `edge://extensions`.
3. Turn on **Developer mode** and choose **Load unpacked**.
4. Select this repository's **extension** directory (the folder containing `manifest.json`).
5. Pin **Tailscale Browser Proxy** to the toolbar and open it.

The extension starts without changing proxy settings. Saving a profile also leaves routing alone. Click **Use proxy** to apply it.

## Set up a connection

### Option A: local SOCKS5 tunnel over Tailscale

You need Tailscale connected on your computer and a remote device you control, with a working SSH server and outbound internet. SSH TCP forwarding must be permitted. Verify that you can sign in to that device first. This example uses ordinary OpenSSH over the tailnet; it does not require Tailscale SSH.

In PowerShell or a terminal, replace the example user and Tailscale IP:

```powershell
ssh -N -D 127.0.0.1:1080 -o ExitOnForwardFailure=yes -o ServerAliveInterval=30 -o ServerAliveCountMax=3 youruser@100.80.12.34
```

Confirm the SSH host key against your device's fingerprint on first connection. Keep the terminal open; no output after successful authentication is normal for `-N`. This opens the SOCKS listener on your computer's loopback interface. Passwords or SSH keys are handled by SSH, not the extension.

Save this profile in the extension:

| Field | Value |
|---|---|
| Name | Home connection |
| Protocol | SOCKS5 |
| Proxy address | 127.0.0.1 |
| Port | 1080 |

For another remote device, open another tunnel on port **1081** and save a second profile. Switching between profiles chooses between their outbound connections. Local SOCKS tunnels are available to other processes on your computer; they are not authentication boundaries against local users.

### Option B: existing tailnet proxy

If an HTTP or SOCKS5 server already runs on a remote Tailscale device, save its Tailscale IPv4/full MagicDNS name and actual listening port. Configure the server to listen on its Tailscale interface and restrict access using your tailnet access rules and server firewall. Do not expose an unauthenticated proxy on a public interface.

This version has no proxy-authentication handler. Use the SSH-tunnel option when you need authentication without storing proxy credentials. Merely enabling an exit node does not start an HTTP/SOCKS server.

## Verify the result

1. Before switching, click **Check public IPv4** and allow access to `api.ipify.org`. Note the result.
2. Start the tunnel or verify your proxy server is running.
3. Click **Use proxy**. “Applied” means the browser accepted the setting; it does not claim the endpoint works.
4. Click **Check public IPv4** again. Compare it with the remote device's outbound IPv4.
5. Open a new web page to test browsing. Existing connections can persist across a switch; restart the browser when testing existing sessions.
6. Click **Restore browser defaults** when finished, then stop SSH with Ctrl+C.

A public-IP check proves only what that HTTPS request observed, not all browser traffic. An unchanged IP can mean both endpoints share an outbound connection. An IP-check failure leaves the proxy applied; check the tunnel or restore defaults.

## Scope and limits

- Affects regular windows in the browser profile where it is installed. Uses `regular_only`; incognito, other browser profiles, other browsers, and other apps are outside its scope.
- Chrome's proxy layer handles supported web requests. This is **not a VPN, anonymity tool, or comprehensive leak blocker**. WebRTC, DNS behavior, browser-internal traffic, and existing sockets need separate evaluation.
- The browser retains its built-in loopback/local proxy bypass behavior. No additional bypass list is installed.
- Restore clears this extension's override, revealing the currently applicable underlying settings. It does not force direct mode or overwrite another owner's settings. If the OS already uses a Tailscale exit node, restore does not disable it.
- Chrome may retain the setting across browser restarts. Keep the chosen proxy/tunnel available, or restore defaults before closing it. Disabling/uninstalling the extension removes its override.
- Supports unauthenticated HTTP and SOCKS5 endpoints. Full Tailscale IPv6 endpoints, short MagicDNS names, authenticated proxies, Firefox, scheduling, and automatic node discovery are not implemented.
- Tailscale permissions, SSH forwarding policy, and server availability must permit the chosen path. This extension does not provision devices or servers.

## Privacy and permissions

See [PRIVACY.md](PRIVACY.md). Required permissions are `proxy` and `storage`. Optional host access is limited to `https://api.ipify.org/*`. No analytics or remote code.

## Development and tests

Node 20+ is needed only for tests. There are no npm dependencies.

```powershell
npm test
```

Tests exercise endpoint validation, browser-setting conflicts, scope, activation/restore behavior, concurrent requests, optional IP permission, failed connectivity, and stale IP results using a mocked Chrome API. They do **not** establish live Chrome/Edge routing or availability of your Tailscale nodes. Before distributing, complete the real-browser checklist in [TESTING.md](TESTING.md).

### Files

```text
extension/
  manifest.json       Permissions and popup/worker entry points
  model.js            Endpoint validation and proxy configuration
  controller.js       Serialized commands and effective-state verification
  background.js       Extension-only message boundary
  popup.html/css/js   Controls and status display
tests/                Node tests; no live network mutations
```

## Technical references

- [Chrome proxy API](https://developer.chrome.com/docs/extensions/reference/api/proxy)
- [Chrome setting scope and precedence](https://developer.chrome.com/docs/extensions/reference/api/types)
- [OpenSSH dynamic port forwarding (`-D`)](https://man.openbsd.org/ssh#D)
- [Tailscale IP addresses](https://tailscale.com/docs/concepts/tailscale-ip-addresses)

This repository is a standalone technical example; it contains no integration with any appointment website or original automation bot.

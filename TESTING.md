# Verification

## Automated

Run `npm test` using Node 20+. Tests use in-memory Chrome API fakes and simulated IP-service responses. They do not change browser/system network settings.

## Real-browser acceptance checklist

Use a separate Chrome/Edge profile and a proxy you control. These checks are manual and are not claimed as completed by the unit tests.

- Load the `extension` folder unpacked. Confirm there are no manifest or worker errors.
- Open the popup: browser defaults should be shown; no connection should change on install.
- Save an SSH SOCKS5 profile for `127.0.0.1:1080`. Reload the popup; the profile should remain.
- Start the SSH tunnel described in README and select **Use proxy**.
- Confirm the setting is shown as applied. Use the optional IP check and a new web page to verify the remote public IP.
- Confirm a separate application and an incognito window retain their previous routing.
- Start a second tunnel to a device with a distinct outbound IP on port 1081; switch profiles and verify the new IP.
- Stop the selected tunnel: a new uncached web request should fail. The extension must not display a successful IP check or silently restore direct routing.
- Restore browser defaults and confirm ordinary browsing returns using the browser's underlying settings.
- Test a competing proxy extension or managed policy: this extension should report the control conflict, not claim successful activation.
- Deny the optional IP permission: proxy selection must still work, and no ipify request should be made.
- Restart the browser with an active profile and verify the displayed status reflects the browser's effective settings.
- Disable/uninstall the extension and confirm its override is released.

Record browser/OS/Tailscale versions and observed results before claiming full integration compatibility. Do not publish real tailnet addresses, credentials, or private screenshots as test fixtures.

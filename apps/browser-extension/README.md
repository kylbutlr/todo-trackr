# Todo Trackr Quick Capture

The Manifest V3 extension captures selected webpage text as a task in your Todo Trackr Inbox. Without a selection, it uses the page title. The task retains the source page URL.

## Install and connect

1. Start your own Todo Trackr server. App Switchr and work-system integrations are not required.
2. Download the matching extension zip from GitHub Releases and extract it into a permanent directory. For a source checkout, use this directory directly.
3. Open `chrome://extensions`, enable **Developer mode**, and select **Load unpacked**. Choose the extracted directory containing `manifest.json`.
4. Open the extension, enter your server origin, and choose **Connect**. Local servers can use `http://127.0.0.1:8888`; remote servers require HTTPS. Allow the requested server permission.
5. If that server requires a password, sign in. An explicitly passwordless server connects without a password.
6. Select text on a normal webpage and press `Command+Shift+E` on Mac or `Ctrl+Shift+E` on other platforms. The popup also provides **Capture this page**.

The public release target is v1.0.0. Use the version-matched GitHub asset once published. A source checkout or locally built zip does not imply the public release is available yet.

Change the shortcut at `chrome://extensions/shortcuts` if another extension uses it. Browser-internal pages and other restricted pages cannot be captured. On Slack web, capture uses a selected message permalink when the page markup exposes one, otherwise the current conversation URL.

## Update manually

Download and extract the new version into the same permanent directory, then select **Reload** on the extension's card at `chrome://extensions`. Reopen the popup and verify the server destination before capturing. GitHub downloads do not receive Chrome Web Store automatic updates.

## Permissions and credentials

- `activeTab` and `scripting` read the active page only after your capture command.
- `storage` saves the selected server and, for protected servers, its session token locally.
- `notifications` reports success and actionable failures.
- Optional host access is requested when you connect to a server. No maintainer server is required for a fresh installation.

The extension never stores your password, receives database credentials, or writes to the captured page. Changing servers clears the previous server's token. **Disconnect** or **Sign out** clears local connection details; it does not change the server's access policy. Passwordless mode gives everyone who can reach that server access to its tasks.

## Source and licensing

Todo Trackr is MIT licensed. The included LICENSE applies to this package. Icons use the shared Todo Trackr artwork. Maintainers can regenerate exports with `npm run icons:web` from the repository root.

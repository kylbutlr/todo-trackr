# Todo Trackr Quick Capture

Capture a selected action and webpage link into your own Todo Trackr server.
Connect the extension to your server and sign in using that server's authentication mode.
The public extension requires no native-app connection or work-management account.
Shared capture, connection, popup logic, fonts and icons come from the common extension assets.
Build with `npm run package:extension`; this folder supplies the public composition entrypoints.

## Connection and capture

1. Build the public ZIP with Node.js 24 using `npm run package:extension`, then unzip it into a permanent folder.
2. For a source installation, load that unzipped folder as an unpacked Chrome extension. Do not load the shared asset folder or the public composition folder directly; packaging combines them.
3. Open the popup, enter your own server origin, and connect. Grant access only to that server. Password-protected servers require their own login; explicitly passwordless standalone servers do not require a fabricated credential.
4. Select text on a webpage and use Command-Shift-E on Mac, Ctrl-Shift-E elsewhere, or the popup's capture action. The Task keeps the page link. Slack web captures use a message permalink when available.

The extension cannot capture Chrome internal or other protected pages. Expired sessions require reconnecting through the popup. Updates to unpacked extensions are manual; preserve the chosen server and use the matching public package. No Mac app or native messaging permission is needed.

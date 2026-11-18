# Security

Todo Trackr stores private task content and links. Run one instance per owner and keep the server and database under that owner's control.

## Reporting a vulnerability

Send a private report to [kylbutlr@gmail.com](mailto:kylbutlr@gmail.com). Include the affected version, deployment mode, reproduction steps, and likely impact. Remove passwords, session tokens, database URLs, private task content, and integration credentials from examples and logs.

Do not include a working exploit against someone else's installation or open a public issue containing private data. A report does not authorize access to another person's system.

## Access modes

Password protection is the default. Passwordless access requires explicit standalone configuration and does not provide user authentication. Anyone who can reach a passwordless server can perform owner actions. Use a loopback listener or a deliberately configured private network/access gateway. Keep the published container port bound to loopback unless you intentionally configure remote access.

Allowed-host and browser-origin checks reduce browser-based cross-site access; they do not replace a firewall, TLS, or an access gateway. Changing the interactive password mode does not disable webhook signatures or service credentials.

## Operations

- Keep production credentials out of source control and client bundles.
- Give clients only the server address and their session credential.
- Use HTTPS for remote connections. Do not bypass certificate warnings.
- Keep PostgreSQL off public ports. Back up its data and test restoration before upgrades.
- Treat JSON exports as private data.
- Keep server, client, database, and dependency versions maintained.
- Verify native release signatures, update signatures, and download checksums before distribution.

This branch is a prerelease implementation. Container deployment, native signing/notarization, and installed-extension verification must pass before a production release is declared supported.

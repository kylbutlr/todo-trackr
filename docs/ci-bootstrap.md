# Initial repository import and CI

Ordinary PR and push checks require an available commit base with common history.
Missing, malformed and unrelated bases fail. They never fall back to HEAD or an
empty tree. Local native preflight still includes pending and untracked changes.

An all-zero base is accepted only for a GitHub push event that explicitly creates
main, with matching repository, ref, after SHA and checked-out SHA, and a parentless
HEAD. Event metadata is read from GITHUB_EVENT_PATH. A new branch with existing
history and an all-zero PR base both fail this exception.

For that verified root import, whitespace checks cover the entire root tree.
Native compilation/tests and version checks remain enabled. The native release
guard requires source distribution and no binary feed. It also requires the
matching original release tag, with consistent metadata, retained at its original
commit. Historical update assets must match that tag byte-for-byte; edited, added
or removed assets fail. Bootstrap does not authorize a new signed release.

A reconstructed public repository can therefore have one commit reachable from
main while original release tags still retain their historical source. Those old
commits remain reachable through tags. Import original tags with main only after
explicit approval and integration checks; never repoint old tags to the new root.
Source packages and release assets are not republished by these checks.

This patch does not grant push, merge, repository deletion/recreation, deployment,
installation or publication authority. Existing workflow permissions, normal
native release rules and manual release workflow remain unchanged. Review any
external deployment connection separately before an initial push.

GitHub documents the event fields in [push webhook payloads](https://docs.github.com/en/webhooks/webhook-events-and-payloads#push) and the runner context in [Actions variables](https://docs.github.com/en/actions/reference/workflows-and-actions/variables). Local event simulations do not establish GitHub-hosted execution acceptance.

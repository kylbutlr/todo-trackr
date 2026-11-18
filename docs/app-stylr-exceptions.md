# App Stylr exceptions

This file records intentional differences from the pinned App Stylr release. An empty table means the app follows the design system without known exceptions.

| Area | App Stylr default | Local requirement | Reason | Owner | Review trigger |
| --- | --- | --- | --- | --- | --- |

| Standalone access | Private hosted utility requires a signed session | Explicit passwordless mode for a single-owner local/private installation; protected remains the default | Owner-selected deployment policy, never inferred from missing credentials | Maintainer | Authentication or deployment boundary changes |

## App Stylr v1.4.1 visual refresh

The shared adapters and Geist assets come from immutable source 6fbc524f07ed7aa7db9c8593bf8116b9440937bc. Sage/dark/Normal and Comfortable remain the defaults, with existing product preferences preserved. Shared geometry uses 4px controls/buttons, 8px cards and 12px dialogs. Feedback stays on neutral surfaces with semantic text/icons. Existing foreground glyphs use the palette-independent Graphite base, with scalable SVG masters and directly rendered high-resolution exports. Keep the incumbent layout, keyboard behavior, auth, data, integrations and platform-specific controls intact.

The task filter toolbar retains its compact 13px product type and wraps its search field above the filters when the task panel is narrow. Shared control geometry, palette and picker treatment remain canonical.

## Public-readiness refinements

Phone navigation adds a labeled native picker for the same task views, named
lists, enabled sources, and settings already offered by the sidebar. Existing
rail shortcuts remain available. The phone task editor keeps its explicit Save
action in the sticky header and bounds the initial notes height. Both use
existing semantic tokens and shared controls; desktop layout, source-managed
restrictions, authentication, and notification opt-in remain product-owned.

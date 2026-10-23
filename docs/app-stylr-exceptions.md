# App Stylr exceptions

This file records intentional differences from the pinned App Stylr release. An empty table means the app follows the design system without known exceptions.

| Area | App Stylr default | Local requirement | Reason | Owner | Review trigger |
| --- | --- | --- | --- | --- | --- |

| Standalone access | Private hosted utility requires a signed session | Explicit passwordless mode for a single-owner local/private installation; protected remains the default | Owner-selected deployment policy, never inferred from missing credentials | Maintainer | Authentication or deployment boundary changes |

# Combine source webhooks with scheduled reconciliation

Connected sources use authenticated webhooks for prompt Task updates and scheduled reconciliation for eventual correctness. The initial Shortcut connector follows both paths so missed events, downtime, changed rules, and temporary source failures can be repaired without sacrificing near-real-time updates.

[ADR 0011](./0011-remove-high-frequency-database-polling.md) restores this event-driven model for Shortcut after the private polling experiment in ADR 0008 consumed excessive database compute. [ADR 0012](./0012-budget-unattended-neon-compute.md) tightens the remaining unattended work.

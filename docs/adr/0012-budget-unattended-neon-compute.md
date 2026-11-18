# Budget unattended Neon compute

Todo Trackr treats every database query as a compute wake, including a query that decides no reconciliation work is due. Unattended jobs must leave more than Neon's five-minute scale-to-zero window between wake periods.

Shortcut and Granola use authenticated webhooks for prompt updates. Their full repair jobs run together at minute 17 every six hours, preserving eventual correctness without keeping Neon continuously active. Either repair can be disabled independently without disabling its webhook path.

The macOS menu-bar app performs no API refresh while both Task surfaces are hidden. Opening Todo Trackr or Mini Trackr triggers an immediate refresh, and visible surfaces retain their 30-second task refresh cadence.

Regression tests reject known schedules that can continuously bridge the five-minute idle window, require both repair jobs to share one six-hour window, verify the repair kill switches, and verify the hidden macOS refresh policy. This decision supersedes the 15-minute repair interval in ADR 0011 while retaining its event-driven direction.

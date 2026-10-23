# Separate Granola discovery from Task approval

Granola note discovery runs automatically through authenticated webhooks and a private scheduled reconciliation with a configurable cadence. Discovery never creates a Task. Explicit personal next steps enter a durable review queue and require `Add Task` before becoming Tasks; unassigned team actions are ignored.

This deliberately separates source observation from Task mutation. Granola meeting notes provide useful personal-action evidence but no authoritative completion lifecycle, and early extraction produced too many vague team follow-ups. Automatic discovery avoids missed notes while manual approval protects the personal action queue from noise.

Accepted and dismissed decisions remain resolved when Granola reorders unrelated meeting bullets. An action that already has a linked Granola Task is also treated as accepted, including Tasks created before the review boundary was introduced.

The Granola review queue is not the Connection Review Mode defined in ADR 0007. It is a source-specific approval boundary that remains active while the connection continues fetching in the background.

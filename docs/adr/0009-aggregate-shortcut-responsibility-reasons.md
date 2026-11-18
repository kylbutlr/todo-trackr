# Aggregate Shortcut Responsibility Reasons with distinct lifecycles

Shortcut Responsibility Rule v2 keeps one Task per Story while recording every independent Responsibility Reason that applies. Assigned Responsibilities remain source-controlled, Requester Responsibilities are muted Background Tasks, and explicit description or comment requests become user-completable Heads Ups that may also complete when Kyle responds in Shortcut. A Task stays open while any reason remains active, so satisfying a Heads Up cannot hide an active assignment or requester obligation.

Rule v2 first runs as a non-mutating shadow because broadening Responsibility beyond direct assignment can create false positives, and comment-response Completion Signals need real-work validation before activation.

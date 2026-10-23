# Use Off, Review, and Automatic Connection modes

Each Source Connection exposes three user-controlled operating modes. Off performs no source processing and preserves existing Tasks. Review fetches only on request and requires explicit approval before applying proposed changes. Automatic applies authenticated source events promptly and runs scheduled reconciliation for eventual correctness.

Changing from Review to Automatic runs one immediate full reconciliation. Automation Rule Version changes still require their own preview and approval before activation, regardless of Connection mode.

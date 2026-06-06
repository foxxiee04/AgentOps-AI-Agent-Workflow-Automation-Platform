# Workflow Runs Module

Handles workflow run records, step run records, run status, run logs, and run detail queries.

Rules:

- Every run points to one immutable workflow version.
- Step records store input, output, timing, error, and retry count.
- Dashboard views should read from durable run state.


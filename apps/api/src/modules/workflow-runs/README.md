# Workflow Runs Module

Handles workflow run records, step run records, run status, run logs, and run detail queries.

Rules:

- Every run points to one immutable workflow version.
- Step records store input, output, timing, error, and retry count.
- Dashboard views should read from durable run state.

Current MVP behavior:

- `GET /workflow-runs/:id` returns the in-memory run record.
- `GET /workflow-runs/:id/steps` builds a timeline from the run's workflow version definition.
- The first trigger node is marked `COMPLETED` after the API publishes the workflow event; later nodes stay `PENDING` until worker persistence is implemented.

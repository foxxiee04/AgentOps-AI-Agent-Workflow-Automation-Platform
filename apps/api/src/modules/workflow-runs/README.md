# Workflow Runs Module

Handles workflow run records, step run records, run status, run logs, and run detail queries.

Rules:

- Every run points to one immutable workflow version.
- Step records store input, output, timing, error, and retry count.
- Dashboard views should read from durable run state.

Current MVP behavior:

- `GET /workflow-runs/:id` returns the in-memory run record.
- `GET /workflow-runs/:id/steps` builds a timeline from the run's workflow version definition.
- `GET /workflow-runs/:id/stream` is a Server-Sent Events stream (`RunStreamService`). It polls the database every 1 s (so it works across API replicas) and emits `snapshot` (`{ run, steps }`) on connect and whenever the run/step fingerprint changes, `ping` every 15 s, and `end` (`{ status }`) once the run is no longer active, then closes. A `error` event (`{ message }`) is sent if the run cannot be read. The stream is capped at 30 minutes and stops all timers when the client disconnects.
- The first trigger node is marked `COMPLETED` after the API publishes the workflow event; later nodes stay `PENDING` until worker persistence is implemented.

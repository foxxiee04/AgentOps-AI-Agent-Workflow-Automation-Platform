# Workflows Module

Handles workflow CRUD, graph validation, publishing, version creation, and run requests.

Rules:

- Workflow definitions belong to a workspace.
- Publishing creates an immutable workflow version.
- Graph validation must run before publish.
- Run requests should create durable state before publishing Kafka events.


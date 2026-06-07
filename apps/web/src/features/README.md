# Web Features

Feature-specific frontend code lives here.

Planned features:

- `auth`
- `workspace`
- `workflow-builder`
- `workflow-runs`
- `agents`
- `integrations`
- `settings`

Move code to `packages/ui` only after it is reused across features.

Implemented feature folders:

- `auth`: login/register form, local MVP session helpers, Google OAuth callback handling, and app route guard.
- `workflow-builder`: React Flow canvas driven by `WorkflowDefinition` from the API.
- `workflows`: publish/run client actions for workflow rows and builder header.
- `agents`: browser-side AI test console that posts to `/ai/test-agent`.

Implemented route-backed feature surfaces without a folder yet:

- `workflow-runs`: `/runs` and `/runs/[id]` render server-side run history and step timelines from workflow-run endpoints.

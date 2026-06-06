# Project Skills

Project-local Codex skills live in `.codex/skills/`. They are designed to make future Codex sessions load the right AgentOps context before coding.

| Skill | Use For |
| --- | --- |
| `agentops-context` | Any AgentOps task; repo orientation and required reading |
| `agentops-frontend` | Next.js UI, dashboard, workflow builder, frontend state |
| `agentops-backend` | NestJS API, Prisma, auth, workspace, API modules |
| `agentops-workflow-engine` | Kafka topics, workflow graph execution, retries, idempotency |
| `agentops-ai-integration` | AI Agent node prompts, structured outputs, provider safety |
| `agentops-devops` | Docker, Kubernetes, Terraform, CI/CD, observability |
| `agentops-review` | Code review, security review, tests, architecture consistency |

## Maintenance Rules

- Keep each `SKILL.md` concise.
- Put detailed project knowledge in `CODEX.md` and `docs/`, then point skills to those files.
- Do not add README files inside individual skill folders.
- Run the skill validator after editing skills.


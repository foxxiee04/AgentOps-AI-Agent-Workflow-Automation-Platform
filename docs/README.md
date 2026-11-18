# Documentation Index

This directory contains the technical documentation for the AgentOps platform. Every document is maintained against the live codebase and verified infrastructure.

## Overview

| Document | Description |
| --- | --- |
| [system-documentation.md](system-documentation.md) | Comprehensive system architecture, data models, UI screen inventory, deployment topology, and security controls. |
| [PORTFOLIO.md](PORTFOLIO.md) | Executive portfolio summary, engineering decisions, and production verification evidence. |
| [roadmap.md](roadmap.md) | Completed platform milestones (2026-11-18) and prioritized technical backlog. |
| [product-direction.md](product-direction.md) | Industry automation signals, human-in-the-loop patterns, and product backlog priorities. |

## Architecture & Specifications

| Document | Description |
| --- | --- |
| [architecture.md](architecture.md) | System design principles, synchronous control plane vs. asynchronous Kafka worker execution plane. |
| [api.md](api.md) | REST API specification, RBAC role requirements, workspace isolation query rules, and admin endpoints. |
| [database.md](database.md) | Relational database schema in PostgreSQL 16, Prisma 7 driver adapter configuration, and migrations. |
| [kafka-topics.md](kafka-topics.md) | Event envelope specification, topic definitions, consumer group topology, and idempotency guarantees. |
| [workflow-engine.md](workflow-engine.md) | Directed graph contract, node types, branch execution lifecycle, and immutable version execution. |
| [ai-agent.md](ai-agent.md) | AI Agent node architecture, OpenAI and deterministic mock providers, JSON Schema validation, and safety guardrails. |
| [security.md](security.md) | Threat model, cookie-based session management, CSRF Origin protection, RBAC rules, and known architectural gaps. |
| [technology-decisions.md](technology-decisions.md) | Architecture Decision Records (ADRs) covering monorepo tooling, visual design, auth patterns, and AWS infrastructure. |

## Operations & Deployment

| Document | Description |
| --- | --- |
| [deployment.md](deployment.md) | Multi-tier deployment strategy across local Docker Compose, Kubernetes manifests, and Terraform. |
| [local-runbook.md](local-runbook.md) | Local environment startup, Docker Compose container stack, port allocations, and smoke tests. |
| [production-runbook-aws.md](production-runbook-aws.md) | AWS EKS production cluster provisioning, live verification, teardown, and operational troubleshooting. |
| [aws-kubernetes-deployment.md](aws-kubernetes-deployment.md) | Architectural comparison of single-node EC2+k3s dev and managed AWS EKS production environments. |
| [observability.md](observability.md) | Prometheus metrics catalog, 5 provisioned Grafana dashboards, Alertmanager webhooks, and Tempo distributed tracing. |

## Quality & Testing

| Document | Description |
| --- | --- |
| [test-scenarios.md](test-scenarios.md) | Test suite specifications across Vitest unit tests, real Kafka/Postgres integration tests, and Playwright E2E scenarios. |
| [evidence/prod-verification.md](evidence/prod-verification.md) | Automated production verification report (27/27 checks passed on AWS EKS cluster). |
| [agents.md](agents.md) | Role profiles and operational scope for autonomous engineering subagents. |
| [skills.md](skills.md) | Repository-local Codex skill configurations for context-aware automation. |

## Design & Repository Standards

| Document | Description |
| --- | --- |
| [design/design-brief.md](../design/design-brief.md) | Full creative brief for the Moss Atelier visual language, color tokens, and animation standards. |
| [apps/web/DESIGN.md](../apps/web/DESIGN.md) | Working frontend summary of CSS variables, font families, and component styling rules. |
| [CONTRIBUTING.md](../CONTRIBUTING.md) | Contribution standards, branch naming taxonomy, conventional commit style, and PR requirements. |
| [SECURITY.md](../SECURITY.md) | Vulnerability disclosure policy, supported versions, and foundational security controls. |

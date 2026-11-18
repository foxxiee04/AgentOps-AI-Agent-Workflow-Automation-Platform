# Security Policy

## Reporting a vulnerability

Report vulnerabilities through a **private security advisory** on the GitHub repository (`Security` > `Advisories` > `Report a vulnerability`). Do not open a public issue, and do not include exploit details, credentials or personal data in a public discussion.

There is no dedicated security email address. The advisory is the only supported private channel.

Please include:

- the affected component (web, API, worker, infrastructure or CI),
- the version or commit you tested,
- reproduction steps or a proof of concept,
- the impact you believe it has.

The maintainer will review the advisory, ask for anything missing, and coordinate disclosure after a fix is available.

## Supported versions

| Version                           | Supported |
| --------------------------------- | --------- |
| `main`                            | Yes       |
| Older commits, branches and forks | No        |

The project has no released version yet (`package.json` is `0.1.0`) and does not maintain long-lived release branches. Security fixes land on `main`.

## Security model

The full list of implemented controls and known gaps is in [docs/security.md](docs/security.md). In summary:

| Area                | Control                                                                                                                                                                                                                          |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Sessions            | JWT access token (15 minutes) and rotating refresh token (30 days) in HttpOnly, `SameSite=Lax` cookies; passwords hashed with argon2; refresh tokens stored hashed and revoked on logout or account disable.                     |
| CSRF                | A global Origin/Referer guard rejects cookie-carrying writes that do not come from `WEB_APP_URL`; requests with a Bearer token and cookie-less webhooks are exempt.                                                              |
| Authorization       | Every route is guarded by default; workspace roles (`OWNER`, `ADMIN`, `MEMBER`, `VIEWER`) are resolved from `WorkspaceMember`, never from a client-supplied role. `/dashboard/*` requires `?workspaceId=` and at least `VIEWER`. |
| Platform admin      | `PLATFORM_ADMIN_EMAILS` bootstraps admins, who can grant/revoke the flag and disable accounts in `/admin`; admins cannot change their own account, and every admin action is audited.                                            |
| Disabled accounts   | Disabling an account revokes its refresh tokens and the global JWT guard checks the flag on every request, so an existing session loses access immediately.                                                                      |
| Rate limits         | Global per-IP API limit (default 120/minute) plus a stricter auth limit (default 10/minute); health and metrics are exempt.                                                                                                      |
| Data protection     | PII is masked before AI calls and in responses, prompts are checked for injection, AI output is JSON-Schema validated, and daily AI call/token quotas are enforced per workspace.                                                |
| Secrets             | No secrets in Git, images or manifests; production values live in AWS Secrets Manager and are synced by External Secrets. CI uses GitHub OIDC instead of static AWS keys.                                                        |
| Supply chain and CI | gitleaks, Trivy (CRITICAL/HIGH gate) and `pnpm audit --prod` run in CI; runtime images drop the bundled `npm`/`corepack` CLIs.                                                                                                   |
| Runtime             | Containers run as non-root with a read-only root filesystem, NetworkPolicies restrict pod-to-pod traffic, and the API enables Helmet and intentional CORS.                                                                       |

Known gaps are documented rather than hidden. Examples: access JWTs are stateless (logout does not revoke an already-issued access token before it expires), rate limits are per replica because Redis is not used for distributed limiting, MSK traffic is plaintext inside the VPC, and there is no WAF in front of the ingress. See [docs/security.md](docs/security.md) for the current list.

# Security

Security is part of the MVP, not a later polish step.

## Auth

- Use password hashing with argon2 or bcrypt.
- Use JWT access tokens and refresh-token rotation.
- Store refresh tokens hashed.
- Add logout and token revocation behavior.
- The web app never sees tokens. The API sets them as HttpOnly cookies: `agentops_access` (JWT, `Path=/`, 15 minutes) and `agentops_refresh` (`Path=/auth`, 30 days), both `SameSite=Lax` and `Secure` unless `APP_ENV=local`. Login/register/refresh responses to the web origin carry only `{ user }`; clients without that Origin (Postman, k6, integration tests) still get `accessToken`/`refreshToken` in JSON and use `Authorization: Bearer`. Set `AUTH_COOKIE_DOMAIN` (e.g. `.example.com`) when web and API are on sibling subdomains so server-rendered pages receive the cookie.
- Google sign-in uses the server authorization-code flow: `GET /auth/google` redirects to Google and `GET /auth/google/callback` finishes the exchange. The OAuth `state` parameter is signed with `JWT_ACCESS_SECRET` (no separate secret is needed). A first-time Google user gets a personal workspace with role `OWNER`, exactly like email registration; returning users keep their memberships. Configure `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET` and `GOOGLE_OAUTH_REDIRECT_URI` (locally `http://localhost:4000/auth/google/callback`; production `https://api.<web host>/auth/google/callback`). In production the client id and secret live in the Secrets Manager secret `agentops/prod/app` and reach the API through External Secrets; the redirect URI is plain configuration in the ConfigMap. In Google Cloud Console the OAuth client must list the redirect URI and the JavaScript origin for every environment, and while the consent screen is in "Testing" only the listed test users can sign in.
- Optional demo onboarding: when `DEMO_WORKSPACE_JOIN_ROLE` (`OWNER`, `ADMIN`, `MEMBER` or `VIEWER`) is set and the `ws_demo` workspace exists, a newly created user (email or Google) also joins it with that role. The production overlay sets `VIEWER`, so a new Google user can read the demo data next to their empty personal workspace. Unset or invalid values add no membership.
- Facebook OAuth is intentionally not in the MVP path yet; add it only if the target segment needs consumer/social acquisition rather than B2B workspace login.

## Authorization

- Platform administrators: `User.isPlatformAdmin`. Accounts listed in `PLATFORM_ADMIN_EMAILS` (comma separated; in production it lives in the Secrets Manager secret `agentops/prod/app`, not in the repository) get the flag on sign-in; admins grant or revoke it for others in the admin console. The flag is never removed automatically.
- Disabled accounts (`User.disabledAt`): sign-in, Google sign-in and refresh are refused with 403/401, all refresh tokens are revoked when the account is disabled, and the global JWT guard checks the flag on every request, so an existing session loses access immediately rather than when its 15-minute access token expires.
- Admin console actions (disable, enable, grant, revoke) are written to `AuditLog` with `workspaceId = null` and the acting admin; admins cannot change their own account.

Roles:

```txt
OWNER
ADMIN
MEMBER
VIEWER
```

Rules:

- OWNER manages billing/workspace settings.
- ADMIN publishes and deletes workflows.
- MEMBER creates and runs workflows.
- VIEWER can only view dashboards and run history.

## API Security

- Validate all inputs.
- Enable rate limiting.
- Configure CORS intentionally.
- Use Helmet or equivalent HTTP hardening.
- Add audit logs for sensitive changes.

## Webhook/HTTP Node Security

- Allow only GET and POST in the MVP.
- Use a maximum timeout of 10 seconds.
- Retry at most 3 times.
- Validate URLs and block private/internal IP ranges when implementing real outbound calls.

## AI Security

- Mask sensitive data where possible.
- Never send secrets to AI providers.
- Validate model output.
- Track usage and quota.
- Make prompt/output storage configurable.

## Implemented controls (2026-10-19)

These controls are in place as of this date:

- Every API route requires a valid access token via the global `JwtAuthGuard`, read from `Authorization: Bearer` or else the HttpOnly `agentops_access` cookie; only routes marked `@Public()` are exempt: health (`/health/live`, `/health/ready`), `/metrics`, `POST /auth/login|register|refresh|logout`, `GET /auth/google` and `/auth/google/callback`, `POST /webhooks/:workflowId`, and `POST /notifications/alertmanager`, which checks a shared `ALERTMANAGER_WEBHOOK_TOKEN` with a constant-time comparison (no token is accepted only when `APP_ENV=local`).
- Workspace authorization resolves the workspace (workspace `:id`, workflow's workspace, or `workspaceId` from body/query) and checks the caller's `WorkspaceMember` role: VIEWER reads, MEMBER create/update/run, ADMIN publish/delete/invite, OWNER member role changes. Lists (`GET /workflows`, `GET /workspaces`) are scoped to the caller's workspaces. Unauthenticated -> 401; not a member or insufficient role -> 403.
- Dashboard endpoints are workspace-isolated: every `GET /dashboard/*` route uses the `workspaceQuery` scope in `apps/api/src/common/rbac/`, requires `?workspaceId=` and a membership with role `VIEWER` or higher (400 without the query parameter, 403 when the caller is not a member), and filters all data by that workspace. `PATCH /dashboard/sales-tasks/:id?workspaceId=` requires `MEMBER`. Before this change the dashboard returned data from all workspaces.
- `GET /auth/me` (and the user object of login/register) returns `workspaces: [{ id, name, slug, role }]`, so clients resolve the active workspace from the caller's memberships rather than trusting a client-supplied id.
- Authorization is derived from the JWT subject plus workspace membership; the client-supplied role header is no longer trusted. VIEWER gets 403 on approval.
- The approval endpoint requires `MEMBER` or higher, returns `409` on a duplicate decision (idempotent, first decision wins), and writes an audit log row per decision.
- A global API rate limit applies (`API_RATE_LIMIT_PER_MINUTE`, default 120 per IP per minute), plus `AUTH_RATE_LIMIT_PER_MINUTE` (default 10) on login/register/refresh; health and metrics are not throttled. Limits are per API replica (in-memory), so set `API_TRUST_PROXY` to the hop count (e.g. `1` behind ingress-nginx, never `true`) to rate-limit per client IP.
- Browser sessions use HttpOnly cookies set by the API (see Auth); logout revokes the refresh token and clears both cookies. Server components forward the incoming Cookie header to the API; browser fetches use `credentials: "include"` and retry once after a cookie refresh on 401. Nothing auth-related is kept in localStorage or JS-readable cookies.
- CSRF: the global `CsrfOriginGuard` (between the throttler and `JwtAuthGuard`) checks POST/PUT/PATCH/DELETE requests that carry an auth cookie or target `/auth/*`. The `Origin` header (or the `Referer` origin) must equal the `WEB_APP_URL` origin; a cookie-carrying write with neither header is rejected with 403. Requests with a Bearer header skip the check, and so do cookie-less calls such as webhooks. CORS allows credentials only for the `WEB_APP_URL` origin.
- Passwords are hashed with argon2 and refresh tokens are stored hashed.
- PII is masked before AI calls, and masked PII is returned in API responses and shown in the UI.
- A prompt-injection guardrail is applied to AI inputs.
- AI output is validated against a JSON Schema.
- Daily AI call and token quotas are enforced per workspace (`AI_DAILY_CALL_LIMIT` / `AI_DAILY_TOKEN_LIMIT`).
- Worker logs are redacted.
- No secrets are baked into images or manifests; secrets come from External Secrets.
- Containers run as non-root with a read-only root filesystem.
- NetworkPolicies restrict pod-to-pod traffic.
- CI uses GitHub OIDC for AWS access (no static AWS keys).
- CI runs gitleaks, Trivy, and `pnpm audit`.

## Known gaps

- Access JWTs are stateless: logout revokes the refresh token and clears the cookies, but an access token copied before logout stays valid until it expires (at most 15 minutes). There is no server-side denylist or per-session revocation list yet.
- An XSS bug can no longer read tokens, but it can still send requests as the signed-in user from the web origin while the page is open. Keep a strict Content-Security-Policy on the web app.
- Server components cannot set cookies, so a server-rendered page whose access cookie has expired redirects to `/login`; the login page then restores the session from the refresh cookie and returns to the dashboard (not to the original page).
- The CSRF check trusts exactly one origin (`WEB_APP_URL`). Additional front-ends, or Swagger "Try it out" with cookies instead of a Bearer token, are rejected.
- AI usage, audit and notification endpoints require a valid token but are not yet filtered by a single active workspace the way `GET /dashboard/*` is.
- The Terraform apply roles use `AdministratorAccess`; add a permissions boundary.
- MSK traffic is plaintext inside the VPC. Enable TLS and/or client encryption in transit.
- No WAF in front of the ingress.
- Redis is not used for distributed rate limiting across API replicas; each replica enforces the limit independently, so the effective global rate is multiplied by the replica count.

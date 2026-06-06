# Security

Security is part of the MVP, not a later polish step.

## Auth

- Use password hashing with argon2 or bcrypt.
- Use JWT access tokens and refresh-token rotation.
- Store refresh tokens hashed.
- Add logout and token revocation behavior.

## Authorization

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


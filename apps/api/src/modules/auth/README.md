# Auth Module

Handles registration, login, logout, refresh tokens, current user lookup, password hashing, and token rotation.

Current MVP behavior:

- `POST /auth/register` and `POST /auth/login` issue mock access/refresh tokens for frontend demos.
- `GET /auth/me` returns the user attached to a known in-memory access token, falling back to the demo operator.
- `GET /auth/google` starts Google OAuth when `GOOGLE_OAUTH_CLIENT_ID` and `GOOGLE_OAUTH_CLIENT_SECRET` are configured.
- `GET /auth/google/callback` exchanges the Google authorization code, validates core ID-token claims, and redirects to the web callback with a short-lived demo session fragment.

Security expectations:

- Hash passwords.
- Hash stored refresh tokens.
- Rate-limit auth endpoints.
- Never return token hashes or password hashes.

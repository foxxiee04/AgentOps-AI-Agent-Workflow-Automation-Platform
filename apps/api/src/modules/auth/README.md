# Auth Module

Handles registration, login, logout, refresh tokens, current user lookup, password hashing, and token rotation.

Current MVP behavior:

- `POST /auth/register` and `POST /auth/login` issue mock access/refresh tokens for frontend demos.
- `GET /auth/me` returns the user for the access token from the Bearer header or the `agentops_access` cookie (401 otherwise).
- `GET /auth/google` starts Google OAuth when `GOOGLE_OAUTH_CLIENT_ID` and `GOOGLE_OAUTH_CLIENT_SECRET` are configured.
- `GET /auth/google/callback` exchanges the Google authorization code, validates core ID-token claims, sets the HttpOnly session cookies, and redirects to the web callback with only the user profile and redirect path in the fragment.
- Login/register/refresh/Google callback set HttpOnly cookies `agentops_access` (Path=/, 15 min) and `agentops_refresh` (Path=/auth, 30 days); logout revokes the refresh token and clears both. Responses to the `WEB_APP_URL` origin omit the tokens from JSON; other clients still receive them for `Authorization: Bearer` use.

Security expectations:

- Hash passwords.
- Hash stored refresh tokens.
- Rate-limit auth endpoints.
- Never return token hashes or password hashes.

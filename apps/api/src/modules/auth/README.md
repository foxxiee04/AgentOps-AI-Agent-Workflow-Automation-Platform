# Auth Module

Handles registration, login, logout, refresh tokens, current user lookup, password hashing, and token rotation.

Security expectations:

- Hash passwords.
- Hash stored refresh tokens.
- Rate-limit auth endpoints.
- Never return token hashes or password hashes.


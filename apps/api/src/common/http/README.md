# API HTTP Common

HTTP-level helpers for the NestJS API live here.

Current pieces:

- `RequestIdMiddleware`: ensures every request and response has an `x-request-id`.
- `RequestLoggingMiddleware`: logs method, path, status, duration, and request ID.
- `HttpExceptionFilter`: returns consistent error JSON with `requestId`, `path`, and `timestamp`.

Use these utilities at the API boundary only. Feature modules should keep business rules in their own services.

# Health Module

The health module exposes operational checks for the API.

Endpoints:

- `GET /health/live`: process liveness for container orchestration.
- `GET /health/ready`: dependency readiness for PostgreSQL, Redis, and Kafka.

Readiness uses NestJS Terminus so Kubernetes, Docker smoke tests, and Postman checks all receive a standard health response.

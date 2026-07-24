FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@11.5.2 --activate
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json tsconfig.base.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY apps/workflow-worker/package.json apps/workflow-worker/package.json
COPY apps/ai-worker/package.json apps/ai-worker/package.json
COPY apps/tool-worker/package.json apps/tool-worker/package.json
COPY apps/notification-worker/package.json apps/notification-worker/package.json
COPY packages/shared/package.json packages/shared/package.json
COPY packages/events/package.json packages/events/package.json
COPY packages/config/package.json packages/config/package.json
COPY packages/database/package.json packages/database/package.json
COPY packages/observability/package.json packages/observability/package.json
COPY packages/ui/package.json packages/ui/package.json
RUN pnpm install --frozen-lockfile

FROM deps AS builder
ARG WORKER_PACKAGE=@agentops/workflow-worker
COPY . .
RUN pnpm --filter ${WORKER_PACKAGE}... build

FROM base AS runner
ARG WORKER_MAIN=apps/workflow-worker/dist/main.js
ENV NODE_ENV=production
ENV WORKER_MAIN=${WORKER_MAIN}
COPY --from=builder /app /app
CMD ["sh", "-c", "node ${WORKER_MAIN}"]

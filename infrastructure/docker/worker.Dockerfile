# syntax=docker/dockerfile:1.7
ARG NODE_IMAGE=node:22-alpine

# hadolint ignore=DL3006
FROM ${NODE_IMAGE} AS base
ENV PNPM_HOME=/pnpm
ENV PATH=/pnpm:$PATH
# The image installs with --store-dir /pnpm/store (BuildKit cache), which differs from storeDir in
# pnpm-workspace.yaml; skip pnpm 11's pre-run dependency check so scripts do not try to reinstall.
ENV pnpm_config_verify_deps_before_run=false
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
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store pnpm install --frozen-lockfile --store-dir /pnpm/store

FROM deps AS builder
ARG WORKER_PACKAGE=@agentops/workflow-worker
COPY . .
RUN pnpm --filter ${WORKER_PACKAGE}... build
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store pnpm --filter ${WORKER_PACKAGE} deploy --prod --legacy --store-dir /pnpm/store /out
# @prisma/client 7 declares the prisma CLI (and typescript) as peers, so `pnpm deploy --prod` also ships the
# CLI, Studio and PGlite (~200 MB). The generated client only loads @prisma/client/runtime: drop the CLI-only packages.
RUN rm -rf /out/node_modules/.pnpm/prisma@* /out/node_modules/.pnpm/@prisma+studio-core@* /out/node_modules/.pnpm/@prisma+dev@*       /out/node_modules/.pnpm/@electric-sql+pglite* /out/node_modules/.pnpm/typescript@*

# hadolint ignore=DL3006
FROM ${NODE_IMAGE} AS runner
RUN apk add --no-cache tini
ENV NODE_ENV=production WORKER_METRICS_PORT=9100
WORKDIR /app
COPY --from=builder --chown=node:node /out ./
USER node
EXPOSE 9100
HEALTHCHECK --interval=15s --timeout=5s --start-period=30s --retries=3 CMD ["node", "-e", "fetch('http://127.0.0.1:'+(process.env.WORKER_METRICS_PORT||9100)+'/health/live').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"]
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "dist/main.js"]

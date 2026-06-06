FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@11.5.2 --activate
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json tsconfig.base.json ./
COPY apps/web/package.json apps/web/package.json
COPY packages/shared/package.json packages/shared/package.json
COPY packages/ui/package.json packages/ui/package.json
COPY packages/config/package.json packages/config/package.json
COPY packages/events/package.json packages/events/package.json
COPY packages/database/package.json packages/database/package.json
RUN pnpm install --frozen-lockfile

FROM deps AS builder
COPY . .
RUN pnpm --filter @agentops/web build

FROM base AS runner
ENV NODE_ENV=production
COPY --from=builder /app /app
EXPOSE 3000
CMD ["pnpm", "--filter", "@agentops/web", "start"]


FROM node:20-alpine AS base

RUN corepack enable && corepack prepare pnpm@8.15.0 --activate

WORKDIR /app

# Dependencies stage
FROM base AS deps

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/core/package.json ./packages/core/
COPY apps/server/package.json ./apps/server/

RUN pnpm install --frozen-lockfile

# Build stage
FROM base AS builder

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages/shared/node_modules ./packages/shared/node_modules
COPY --from=deps /app/packages/core/node_modules ./packages/core/node_modules
COPY --from=deps /app/apps/server/node_modules ./apps/server/node_modules
COPY . .

RUN pnpm build

# Production stage
FROM base AS runner

ENV NODE_ENV=production

COPY --from=builder /app/package.json ./
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/packages/shared/package.json ./packages/shared/
COPY --from=builder /app/packages/core/dist ./packages/core/dist
COPY --from=builder /app/packages/core/package.json ./packages/core/
COPY --from=builder /app/apps/server/dist ./apps/server/dist
COPY --from=builder /app/apps/server/package.json ./apps/server/

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages/shared/node_modules ./packages/shared/node_modules
COPY --from=deps /app/packages/core/node_modules ./packages/core/node_modules
COPY --from=deps /app/apps/server/node_modules ./apps/server/node_modules

EXPOSE 3000

CMD ["node", "apps/server/dist/index.js"]


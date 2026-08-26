FROM node:24.12.0-bookworm-slim AS build

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@11.9.0 --activate

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY apps/worker/package.json apps/worker/package.json
COPY packages packages

RUN pnpm install --frozen-lockfile --filter @protege-mais/worker...

COPY apps/worker apps/worker
COPY tsconfig.json tsconfig.base.json ./

RUN pnpm --filter @protege-mais/worker build

FROM node:24.12.0-bookworm-slim

WORKDIR /app
ENV NODE_ENV=production

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/apps/worker/package.json ./apps/worker/package.json
COPY --from=build /app/apps/worker/dist ./apps/worker/dist

CMD ["node", "apps/worker/dist/apps/worker/src/index.js"]

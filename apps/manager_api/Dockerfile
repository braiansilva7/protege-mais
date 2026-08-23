FROM node:24.12.0-bookworm-slim AS build

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@11.9.0 --activate

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY apps/manager_api/package.json apps/manager_api/package.json

RUN pnpm install --frozen-lockfile --filter manager_api...

COPY apps/manager_api apps/manager_api
COPY packages packages
COPY tsconfig.json tsconfig.json

RUN rm -rf apps/manager_api/dist && pnpm --filter manager_api build

FROM node:24.12.0-bookworm-slim

WORKDIR /app
ENV NODE_ENV=production

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/apps/manager_api/package.json ./apps/manager_api/package.json
COPY --from=build /app/apps/manager_api/dist ./apps/manager_api/dist
COPY --from=build /app/packages/plugins/i18next/locales ./apps/manager_api/dist/packages/plugins/i18next/locales

EXPOSE 3000

CMD ["node", "apps/manager_api/dist/apps/manager_api/src/server.js"]

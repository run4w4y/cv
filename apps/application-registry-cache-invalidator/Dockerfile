FROM oven/bun:1.3.13 AS build

WORKDIR /workspace
COPY . .

RUN bun install --frozen-lockfile
RUN bunx nx run application-registry-cache-invalidator:build --skip-nx-cache

FROM node:24.18.0-bookworm-slim

ENV NODE_ENV=production
WORKDIR /app

COPY --from=build /workspace/apps/application-registry-cache-invalidator/dist/main.mjs ./cache-invalidator.mjs

USER node
CMD ["node", "/app/cache-invalidator.mjs"]

FROM oven/bun:1.3.13 AS build

WORKDIR /workspace
COPY . .

RUN bun install --frozen-lockfile
RUN bunx nx run application-registry-pdf-worker:build --skip-nx-cache

FROM node:24.17.0-bookworm-slim

ENV NODE_ENV=production
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
WORKDIR /app

RUN DEBIAN_FRONTEND=noninteractive npm init -y \
  && npm install --omit=dev --ignore-scripts playwright@1.61.1 \
  && npm cache clean --force

COPY --from=build /workspace/apps/application-registry-pdf-worker/dist/main.mjs ./pdf-worker.mjs

USER node
CMD ["node", "/app/pdf-worker.mjs"]

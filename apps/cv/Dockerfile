FROM oven/bun:1.3.13-alpine AS build

WORKDIR /workspace
COPY . .

ENV NEXT_TELEMETRY_DISABLED=1
ENV NX_DAEMON=false

RUN --mount=type=cache,target=/root/.bun/install/cache bun install --frozen-lockfile
RUN bunx nx run cv:build --skip-nx-cache

FROM node:24.18.0-alpine

WORKDIR /app

ENV HOSTNAME=0.0.0.0
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
ENV PORT=3000

COPY --from=build --chown=node:node /workspace/apps/cv/.next/standalone ./
COPY --from=build --chown=node:node /workspace/apps/cv/.next/static ./apps/cv/.next/static

USER node
EXPOSE 3000
CMD ["node", "apps/cv/server.js"]

FROM oven/bun:1.3.13-alpine AS build

WORKDIR /workspace
COPY . .

ENV NX_DAEMON=false

RUN --mount=type=cache,target=/root/.bun/install/cache bun install --frozen-lockfile
RUN bunx nx run application-registry-api:build --skip-nx-cache

FROM oven/bun:1.3.13-alpine

WORKDIR /app
COPY --from=build /workspace/apps/application-registry-api/dist/main.js ./application-registry-api.js

ENV SERVER_HOST=0.0.0.0
ENV SERVER_PORT=3000

USER bun
EXPOSE 3000
CMD ["bun", "/app/application-registry-api.js"]

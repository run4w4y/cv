FROM oven/bun:1.3.13-alpine AS build

WORKDIR /workspace
COPY . .

ENV NX_DAEMON=false

RUN --mount=type=cache,target=/root/.bun/install/cache bun install --frozen-lockfile
RUN bunx nx run-many --target=build --projects=application-registry-management,application-registry-api --skip-nx-cache

FROM oven/bun:1.3.13-alpine

WORKDIR /app
COPY --from=build /workspace/apps/application-registry-api/dist/main.js ./application-registry-api.js
COPY --from=build /workspace/apps/application-registry/dist ./public

ENV SERVER_HOST=0.0.0.0
ENV SERVER_PORT=3000
ENV STATIC_ASSETS_DIRECTORY=/app/public

USER bun
EXPOSE 3000
CMD ["bun", "/app/application-registry-api.js"]

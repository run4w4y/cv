FROM oven/bun:1.3.13-alpine AS build

WORKDIR /workspace
COPY . .

RUN bun install --frozen-lockfile
RUN bunx nx run application-registry-pdf-dispatcher:build --skip-nx-cache

FROM oven/bun:1.3.13-alpine

WORKDIR /app
COPY --from=build /workspace/apps/application-registry-pdf-dispatcher/dist/main.js ./pdf-dispatcher.js

USER bun
ENTRYPOINT ["timeout", "-s", "TERM", "4m"]
CMD ["bun", "/app/pdf-dispatcher.js"]

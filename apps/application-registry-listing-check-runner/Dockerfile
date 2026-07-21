FROM oven/bun:1.3.13-alpine AS build

WORKDIR /workspace
COPY . .

RUN bun install --frozen-lockfile
RUN bunx nx run application-registry-listing-check-runner:build --skip-nx-cache

FROM oven/bun:1.3.13-alpine

WORKDIR /app
COPY --from=build /workspace/apps/application-registry-listing-check-runner/dist/main.js ./listing-check-runner.js

USER bun
ENTRYPOINT ["timeout", "-s", "TERM", "19m"]
CMD ["bun", "/app/listing-check-runner.js"]

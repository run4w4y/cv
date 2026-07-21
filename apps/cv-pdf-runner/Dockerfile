FROM oven/bun:1.3.13 AS build

WORKDIR /workspace
COPY . .

RUN bun install --frozen-lockfile
RUN bunx nx run cv-pdf-runner:build --skip-nx-cache

FROM mcr.microsoft.com/playwright:v1.61.1-noble

ENV NODE_ENV=production
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
WORKDIR /app

RUN npm init -y \
  && npm install --omit=dev --ignore-scripts playwright@1.61.1 \
  && npm cache clean --force

COPY --from=build /workspace/apps/cv-pdf-runner/dist/main.mjs ./cv-pdf-runner.mjs

USER pwuser
CMD ["node", "/app/cv-pdf-runner.mjs"]

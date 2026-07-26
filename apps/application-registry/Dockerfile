FROM oven/bun:1.3.13-alpine AS build

WORKDIR /workspace
COPY . .

ARG VITE_CV_WEB_ORIGIN=https://cv.4w4y.run
ENV NX_DAEMON=false
ENV VITE_CV_WEB_ORIGIN=${VITE_CV_WEB_ORIGIN}

RUN --mount=type=cache,target=/root/.bun/install/cache bun install --frozen-lockfile
RUN bunx nx run application-registry-management:build --skip-nx-cache

FROM nginxinc/nginx-unprivileged:1.29.5-alpine

COPY apps/application-registry/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /workspace/apps/application-registry/dist /usr/share/nginx/html

EXPOSE 8080

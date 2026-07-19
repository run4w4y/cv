# Public CV Worker

This Astro application is the server-rendered public CV surface. It owns only
the exact `/c/:token` route. Every other path returns `404`, allowing the
existing Cloudflare Pages project to continue serving legacy routes while the
Worker route is attached only to `/c/*`.

The Worker reads enabled publications through the `CV_PUBLIC_RESOLVER` named
service binding. The registry returns opaque bytes and publication metadata;
this application is the schema-owning boundary that validates
`cv.document.v1` and renders it with `@cv/renderer`.

For local development, run the registry Worker and this Astro app in separate
shells so Wrangler can connect the service binding:

```sh
bun x nx run application-registry-api:dev
bun x nx run cv:dev
```

The public Worker never calls a registry URL and never receives a management
bearer token.

## Testing

`@cv/worker-test-kit/cv-public` runs the built Astro Worker in Miniflare and
supplies a configurable in-process `CV_PUBLIC_RESOLVER` service. The CV test
keeps its document examples and rendering assertions locally while the shared
package owns module loading, Worker composition, resolver responses, and
cleanup.

```sh
bun x nx run cv:test:worker
```

## Production deployment

The existing Cloudflare Pages deployment is deliberately frozen and no longer
managed by this repository. Cloudflare continues to send every legacy path to
Pages. Terraform attaches the new Worker only to `CV_WEB_HOST/c/*`; neither the
Worker's source config nor its deployment config declares a route.

Builds produce Astro's deployable Worker under `dist/server` and immutable
client assets under `dist/client`. The production config writer validates that
layout, keeps the exact `./entry.mjs` and `../client` paths, and writes
`dist/server/wrangler.deploy.json`:

```sh
bun x nx run cv:build
bun apps/cv/scripts/write-wrangler-config.ts \
  apps/cv/dist/server/wrangler.deploy.json
bunx wrangler deploy --config apps/cv/dist/server/wrangler.deploy.json
```

`bun x nx run cv:deploy` performs those steps in order. Production settings are
read from:

- `CV_PUBLIC_WORKER_NAME`, default `cv-public`;
- `CV_PUBLIC_REGISTRY_SERVICE_NAME`, falling back to
  `APPLICATION_REGISTRY_WORKER_NAME` and then `cv-application-registry`;
- `CV_PUBLIC_RESOLVER_ENTRYPOINT`, default `CvPublicResolver`;
- `CV_PUBLIC_COMPATIBILITY_DATE`, default `2026-06-22`.

The service binding is intentionally one-way: `cv-public` binds to the already
deployed registry entrypoint. Do not add a registry-to-CV preview binding. On a
first deployment, deploy the registry Worker first, then `cv-public`, and only
then apply the Terraform route overlay. Until that route exists, the frozen
Pages deployment continues handling the entire hostname.

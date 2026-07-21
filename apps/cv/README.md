# Public CV Worker

Next.js App Router/OpenNext application for the exact `/c/:token` public CV
surface. Cloudflare routes only `/c/*` to this Worker; the frozen Pages project
continues serving every legacy route.

The Worker resolves enabled publications over HTTPS through
`CV_PUBLIC_RESOLVER_URL`. The self-hosted registry returns opaque document bytes
and publication metadata from PostgreSQL/MinIO; this application validates the
code-owned `cv.document.v1` contract and renders it. No management bearer token,
database credential, MinIO credential, or Worker service binding is present.

The public and print layouts are intentionally separate. The public route is a
responsive website, while the A4 renderer is deterministic and used by both
the isolated management preview and the Playwright PDF runner.

## Development

Run a registry API origin and this app in separate shells:

```sh
bun x nx run application-registry-api:build
bun apps/application-registry-api/dist/main.js
bun x nx run cv:dev
```

The checked-in Wrangler config points `CV_PUBLIC_RESOLVER_URL` at
`http://127.0.0.1:3000`. For a self-contained renderer instead:

```sh
bun x nx run cv:dev:fixture
```

Fixture mode serves representative documents at `/c/fixture` and
`/c/_preview/fixture?access=fixture-preview`; it cannot activate in production.

## Testing

```sh
bun x nx run cv:test:e2e
```

Playwright exercises the public and preview routes, responsive behavior, print
layout, actual PDF generation, overflow detection, theme persistence, routing,
security headers, and visual baselines.

## Production deployment

Builds produce an OpenNext Worker and immutable assets under `.open-next`.

```sh
bun x nx run cv:build
bun apps/cv/scripts/write-wrangler-config.ts apps/cv/wrangler.deploy.jsonc
bun apps/cv/scripts/deploy.ts apps/cv/wrangler.deploy.jsonc
```

The generated config reads:

- `CV_PUBLIC_WORKER_NAME`, default `cv-public`;
- `CV_PUBLIC_RESOLVER_URL`, required HTTPS Cloudflare Tunnel origin;
- `CV_PUBLIC_COMPATIBILITY_DATE`, default `2026-07-19`;
- `CV_REVALIDATION_SECRET`, required by the authenticated compatibility purge
  endpoint.

Publication and preview resolver paths are capability-token endpoints. The
Cloudflare Access module bypasses only `/cv-*` at the resolver origin, while the
management UI remains owner-only and `/machine/*` continues to require its
registry bearer token.

Public and preview pages currently render dynamically with
`Cache-Control: private, no-store`. The API still sends best-effort invalidation
requests to `/c/_internal/revalidate`; this keeps the boundary ready for a
future bounded-staleness CDN policy without coupling the self-hosted API to a
Cloudflare Worker binding.

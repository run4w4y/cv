# Public CV service

Standalone Next.js App Router service for public `/c/:token` pages and isolated
preview routes. It resolves publications from the private `cv-registry`
service through a Consul Connect upstream; it has no database, object-store,
management-token, or Cloudflare binding.

The public and private web-preview routes use the same responsive renderer.
The deterministic A4 renderer has a separate, capability-protected route used
only by the PDF worker.

## Development and testing

Run a registry API and the CV app in separate shells:

```sh
bun x nx run application-registry-api:build
bun apps/application-registry-api/dist/main.js
bun x nx run cv:dev
```

For fixture-backed development:

```sh
bun x nx run cv:dev:fixture
```

Fixture mode serves `/c/fixture`,
`/c/_preview/fixture?access=fixture-preview`, and
`/c/_render/fixture?access=fixture-preview`; it cannot activate in production.

```sh
bun x nx run cv:test:e2e
bun x nx run cv:build
docker build -f apps/cv/Dockerfile .
```

## Production

The Next.js build uses `output: standalone`; the image runs the generated Node
server on port 3000. `CV_PUBLIC_RESOLVER_URL` points to the local Consul
upstream, `CV_DEPLOYMENT_ID` identifies the deployed revision, and
`CV_REGISTRY_ORIGIN` is the exact HTTPS Registry origin allowed to frame private
web previews. The packaged desktop origin is allowed separately; development
also permits the fixed Registry localhost origins. Invalid or insecure
production origins fail closed.

Public CV responses advertise a one-day Cloudflare edge TTL plus seven days of
stale-while-revalidate and 30 days of stale-if-error. Preview and internal
routes remain `private, no-store`. Publication changes emit durable registry
events; the dedicated cache invalidator consumes them and purges the configured
public `/c/` prefix through Cloudflare's cache-purge API.

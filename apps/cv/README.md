# Public CV service

Standalone Next.js App Router service for public `/c/:token` pages and isolated
preview routes. It resolves publications from the private `cv-registry`
service through a Consul Connect upstream; it has no database, object-store,
management-token, or Cloudflare binding.

The public and print layouts are intentionally separate. The public route is a
responsive website, while the deterministic A4 renderer is shared by previews
and the PDF worker.

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

Fixture mode serves `/c/fixture` and
`/c/_preview/fixture?access=fixture-preview`; it cannot activate in production.

```sh
bun x nx run cv:test:e2e
bun x nx run cv:build
docker build -f apps/cv/Dockerfile .
```

## Production

The Next.js build uses `output: standalone`; the image runs the generated Node
server on port 3000. `CV_PUBLIC_RESOLVER_URL` points to the local Consul
upstream and `CV_DEPLOYMENT_ID` identifies the deployed revision.

Public CV responses advertise a one-day Cloudflare edge TTL plus seven days of
stale-while-revalidate and 30 days of stale-if-error. Preview and internal
routes remain `private, no-store`. Publication changes trigger exact-URL or
prefix purges directly from the registry API through Cloudflare's cache-purge
API.

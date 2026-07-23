# Self-hosted application registry API

Publicly routed Bun service for the typed application-registry API. It uses
PostgreSQL for state, MinIO for objects, NATS JetStream for domain events, and
Cloudflare's GraphQL API for retained analytics.

Every `/api/registry/*` request presents the configured registry bearer token.
The management web app calls those canonical routes directly; there is no BFF,
credential injection, or alternate API transport. `HttpRouter.cors`
restricts browser access to `REGISTRY_CORS_ALLOWED_ORIGINS`.
Capability-token publication and preview resolvers are exposed at
`/cv-publications/:token` and `/cv-previews/:token`.

Publication services send versioned publication notifications and strict PDF
generation requests to the existing JetStream topology. Enabling a publication
and requesting a PDF are consumed by the PDF worker; applications never create
streams or consumers at runtime.

Runtime dependencies:

- `POSTGRES_*`, `MINIO_*`, and `NATS_*` connection values;
- `REGISTRY_API_TOKEN` and `FACTS_PUBLISH_TOKEN`;
- `REGISTRY_CORS_ALLOWED_ORIGINS`, as a comma-separated list of HTTPS web
  origins;
- `CLOUDFLARE_ANALYTICS_API_TOKEN`, `CLOUDFLARE_ZONE_ID`, and `CV_WEB_HOST`.
  The Cloudflare token needs analytics-read permissions only.

Build and verify:

```sh
bunx nx run application-registry-api:typecheck
bunx nx run application-registry-api:test:unit
bunx nx run application-registry-api:test:integration
bunx nx run application-registry-api:build
docker build -f apps/application-registry-api/Dockerfile .
```

Integration tests use PostgreSQL, MinIO, and NATS through
`@cv/test-infrastructure`; no external test services are required.

# Self-hosted application registry API

Private Bun service for the typed application-registry API. It uses PostgreSQL
for state, MinIO for objects, NATS JetStream for domain events, and Cloudflare's
GraphQL and cache-purge APIs for retained edge capabilities.

The separate management-web allocation proxies same-origin browser requests to
this service over Consul Connect. `REGISTRY_BFF_ENABLED` permits those
Access-protected browser requests to use the server-held registry credential;
direct `/machine/*` clients must continue presenting that bearer credential.
Capability-token publication and preview resolvers are exposed at
`/cv-publications/:token` and `/cv-previews/:token`.

Mutation services publish versioned domain events directly to the existing
JetStream topology. Enabling a publication and requesting a PDF are consumed by
the PDF worker; applications never create streams or consumers at runtime.

Runtime dependencies:

- `POSTGRES_*`, `MINIO_*`, and `NATS_*` connection values;
- `REGISTRY_API_TOKEN` and `FACTS_PUBLISH_TOKEN`;
- `CLOUDFLARE_ANALYTICS_API_TOKEN`, `CLOUDFLARE_ZONE_ID`, and `CV_WEB_HOST`.
  The Cloudflare token needs analytics-read and cache-purge permissions.

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

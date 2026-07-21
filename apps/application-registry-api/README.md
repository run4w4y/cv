# Self-hosted application registry API

This Bun application is the canonical PostgreSQL/MinIO runtime for the typed
application registry API and management SPA. It does not replace Cloudflare
DNS, Tunnel, CDN, Access, analytics, the public `/c/*` Worker overlay, or the
frozen Pages deployment.

Runtime dependencies:

- PostgreSQL through `POSTGRES_*`;
- path-style S3/MinIO through `MINIO_*`;
- Cloudflare GraphQL analytics through `CLOUDFLARE_*`;
- registry and facts-publication bearer credentials;
- optional HTTP cache invalidation through the paired `CV_REVALIDATION_URL`
  and `CV_REVALIDATION_SECRET` values.

The capability-token publication and preview resolvers are served over HTTP at
`/cv-publications/:token` and `/cv-previews/:token`. The retained public CV
Worker reaches these routes through `CV_PUBLIC_RESOLVER_URL`; no registry Worker
service binding remains.

`REGISTRY_BFF_ENABLED` defaults to `false`. Enable it only after Cloudflare
Access protects the management hostname.

PDF requests are committed to the PostgreSQL outbox. The dedicated dispatcher
publishes pending requests to NATS JetStream; the API does not perform an
immediate queue dispatch.

Build and verify:

```sh
bunx nx run application-registry-api:typecheck
bunx nx run application-registry-api:test:unit
bunx nx run application-registry-api:test:integration
bunx nx run application-registry-api:build
docker build -f apps/application-registry-api/Dockerfile .
```

Integration tests start isolated PostgreSQL and MinIO containers through
`@cv/test-infrastructure`; no external test services or Miniflare are required.

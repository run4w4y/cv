# Application registry API

This CV-owned pack deploys the bearer-authenticated Bun application registry
API at the `cv-api` Traefik hostname.
PostgreSQL, MinIO, Vault, Consul, Traefik, and Cloudflare Tunnel remain owned by
the adjacent infrastructure repository.

The pack is safe to register before cutover:

- `enabled` defaults to `false`, producing no allocation;
- the API/Envoy reservations are deliberately small for the single constrained
  VPS and can be adjusted after observing real usage.

Required Vault paths are:

- `secret/data/cv-registry/postgres-credentials`, created by the PostgreSQL
  infrastructure module;
- `secret/data/cv-registry/minio-credentials`, created by the MinIO
  infrastructure module;
- `secret/data/cv-registry/nats-credentials`, created by the NATS
  infrastructure module for the distinct `cv-registry` NATS identity;
- `secret/data/cv-registry/runtime`, populated from the existing CV production
  secrets before the first allocation is enabled.

Render before registering:

```sh
nomad-pack render nomad/packs/application-registry-api \
  --parser-v1 \
  --var 'docker_image=ghcr.io/run4w4y/cv-application-registry-api@sha256:<digest>'
```

Apply `terraform/live/prod/jetstream` before enabling the allocation. The API
publishes to the existing `REGISTRY_EVENTS` stream and has no permission to
create or modify JetStream resources.

The API owns its Traefik route and accepts browser requests only from
`cors_allowed_origins`. Cloudflare Access is not applied to this hostname; the
API validates the explicit bearer token supplied by every Registry client.

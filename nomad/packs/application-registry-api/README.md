# Application registry API

This CV-owned pack deploys the Bun application registry API and management SPA.
PostgreSQL, MinIO, Vault, Consul, Traefik, and Cloudflare Tunnel remain owned by
the adjacent infrastructure repository.

The pack is safe to register before cutover:

- `enabled` defaults to `false`, producing no allocation;
- the default Traefik hostname is the temporary `registry-origin` subdomain;
- `bff_enabled` defaults to `false`, so an unprotected origin cannot inject the
  registry bearer token for browser requests;
- the API/Envoy reservations are deliberately small for the single constrained
  VPS and can be adjusted after observing real usage.

Required Vault paths are:

- `secret/data/cv-registry/postgres-credentials`, created by the PostgreSQL
  infrastructure module;
- `secret/data/cv-registry/minio-credentials`, created by the MinIO
  infrastructure module;
- `secret/data/cv-registry/runtime`, populated from the existing CV production
  secrets before the first allocation is enabled.

Render before registering:

```sh
nomad-pack render nomad/packs/application-registry-api \
  --parser-v1 \
  --var 'docker_image=ghcr.io/run4w4y/cv-application-registry-api@sha256:<digest>'
```

Enable one allocation first on the temporary hostname with BFF authentication
still disabled. Test `/health`, OpenAPI, machine transport, PostgreSQL, MinIO,
analytics, and cache invalidation through that hostname. Enable BFF injection
only after the hostname is covered by the intended Cloudflare Access policy.

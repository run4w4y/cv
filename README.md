# CV workspace

Personal application-registry and tailored-CV system. The applications run on
the Nomad/Consul/Vault cluster. Cloudflare remains in front for DNS, Tunnel,
Access, CDN caching, and analytics; no application code runs on Workers or
Pages.

## Runtime applications

- `apps/application-registry-api`: bearer-authenticated Bun API exposed at
  `cv-api.4w4y.run`, using PostgreSQL, MinIO, NATS JetStream, and the
  Cloudflare analytics and cache-purge APIs.
- `apps/application-registry`: management React SPA served by its own
  unprivileged Nginx allocation at `cv-registry.4w4y.run`. Cloudflare Access
  protects the SPA; users configure the API origin and bearer token at runtime.
- `apps/application-registry-listing-check-runner`: one-shot Effect program
  started by a periodic Nomad job.
- `apps/application-registry-pdf-worker`: durable NATS consumer that connects
  to the cluster's generic Chromium CDP service, writes PDFs to MinIO, and
  records results in PostgreSQL.
- `apps/cv`: standalone Next.js server for public and preview CV rendering,
  deployed as its own Nomad allocation.

Cluster-wide services, credentials, Consul intentions, and the generic
Chromium allocation belong to the adjacent `~/infrastructure` repository.
This repository owns CV application images, Nomad Packs, the clean PostgreSQL
migration history, JetStream application topology, Cloudflare edge policy, and
CI deployment workflows.

## Storage and messaging

- PostgreSQL is the sole registry database.
- MinIO is the sole object store for reviewed facts, source artifacts, and
  generated PDFs.
- NATS JetStream is the durable event transport. Terraform owns the
  `REGISTRY_EVENTS` stream and `registry-pdf-worker` consumer; applications
  only publish to or consume existing resources.

## Local verification

Enter the repository's zsh/direnv/Nix shell, then run:

```sh
bun install
bun run quality
bun x nx run application-registry-api:test:integration
bun x nx run application-registry-events-nats:test:integration
bun x nx run application-registry-crud:test:integration
bun x nx run application-registry-service:test:integration
bun x nx run cv:test:e2e
```

`@cv/test-infrastructure` supplies pinned PostgreSQL, MinIO, and NATS
Testcontainers for infrastructure-backed suites.

## Deployment

Pushes to `main` build and publish five application images to GHCR, then deploy
the API, management web app, listing-check runner, PDF worker, and CV web app
through their Nomad Packs. The generic Chromium service and Consul intentions
must already be applied from `~/infrastructure`; the JetStream stack under
`terraform/live/prod/jetstream` must also exist.

Cloudflare routes `cv-api`, `cv-registry`, and `cv` through the existing Tunnel
to Traefik. Access applies only to `cv-registry`; the public `cv-api` service
enforces bearer authentication itself. The project stack also manages the
public-CV cache rule. See `terraform/README.md` and the pack READMEs for the
concrete contracts.

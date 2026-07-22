# CV workspace

Personal application-registry and tailored-CV system. Stateful services run on
the Nomad/Consul/Vault cluster; Cloudflare remains the DNS, Tunnel, Access,
analytics, CDN, and public-CV edge.

The frozen legacy profile remains on its existing Cloudflare Pages deployment.
The `cv-public` Worker overlays only `/c/*`, so the Pages deployment and all
other routes remain untouched.

## Runtime surfaces

- `apps/application-registry-api` is the single Bun API/BFF service. It uses
  PostgreSQL, MinIO, and Cloudflare GraphQL analytics and exposes the public
  publication resolver consumed by `cv-public` over the Tunnel.
- `apps/application-registry-listing-check-runner` is a one-shot Effect/Bun
  program started by a periodic Nomad job.
- `apps/application-registry-pdf-worker` consumes publication and PDF-request
  events one at a time, renders with Playwright/Chromium, stores the PDF in
  MinIO, updates PostgreSQL, and emits completion or failure events.
- `apps/application-registry` is the shared management React application;
  `apps/application-registry-desktop` is its Electron/Codex host.
- `apps/cv` is the retained Next.js/OpenNext Cloudflare Worker for `/c/*`.

PostgreSQL and MinIO users and buckets, the NATS server and authorization,
shared Consul intentions, Vault secrets, and global sidecar defaults belong to
the adjacent `~/infrastructure` repository. This repository owns the database
migrations and JetStream application topology alongside each CV application
image, its Nomad Pack, project-specific Cloudflare policy, and release workflow.

## Storage and messaging

- PostgreSQL is the sole registry database. Its Drizzle history starts from one
  clean baseline in `libs/application-registry/entity/drizzle`.
- MinIO is the sole object store for reviewed facts, source artifacts, and
  generated PDFs.
- NATS JetStream is the durable fan-out transport for versioned registry domain
  events. Its `REGISTRY_EVENTS` stream and `registry-pdf-worker` consumer are
  Terraform-managed; runtime applications only publish or bind. PostgreSQL
  remains the source of application and artifact state.
- `tools/application-registry-migration` is the intentionally temporary,
  one-time D1-export importer. Remove it and the final Terraform `removed`
  block after the production import has been verified.

There is no R2 importer because the retired R2 buckets contain no application
data.

## Local development

Enter the repository's zsh/direnv/Nix shell and install the workspaces:

```sh
bun install
```

Run the Bun registry and the public CV renderer in separate shells:

```sh
bun x nx run application-registry-api:build
bun apps/application-registry-api/dist/main.js
bun x nx run cv:dev
```

The API reads its PostgreSQL, MinIO, registry-token, analytics, and server
configuration from the variables documented in
`apps/application-registry-api/README.md`. The CV Worker reads the API origin
from `CV_PUBLIC_RESOLVER_URL`.

For a self-contained public-renderer preview:

```sh
bun x nx run cv:dev:fixture
```

## Tests

`@cv/test-infrastructure` supplies pinned PostgreSQL, MinIO, and NATS
Testcontainers. Infrastructure-backed suites run with Node's test runner; the
registry system suite launches the production Bun bundle and shares one
PostgreSQL/MinIO pair across its API scenarios.

```sh
bun run quality:biome
bun x nx run-many -t typecheck test:unit --parallel=6
bun x nx run application-registry-api:test:integration
bun x nx run application-registry-events-nats:test:integration
bun x nx run application-registry-crud:test:integration
bun x nx run cv:test:e2e
```

## Deployment

The safe cutover order is:

1. apply the shared infrastructure changes from `~/infrastructure` and verify
   PostgreSQL, MinIO, NATS, Vault credentials, and reduced sidecar allocations;
2. apply `terraform/live/prod/jetstream` after the NATS service is healthy;
3. deploy the disabled Nomad API, listing-check runner, and PDF event worker
   from this repository, then verify them on the Tunnel origin;
4. freeze writes to D1, export it once, import and validate PostgreSQL with
   `tools/application-registry-migration`;
5. enable the API/BFF and background jobs, configure the public Worker with
   `CV_PUBLIC_RESOLVER_URL`, and apply the Cloudflare Access and `/c/*` route
   overlay changes;
6. remove the old registry Worker deployment, the temporary D1 importer, and
   the D1 state-transition block after the cutover is accepted.

Cloudflare DNS, Tunnel, Access, the public Worker, the frozen Pages site, and
analytics intentionally remain. See `terraform/README.md` and the READMEs under
`nomad/packs` for the concrete deployment contracts.

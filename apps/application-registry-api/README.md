# Application registry API

Cloudflare Worker API for the synchronized job-application registry. D1 is the
system of record. `@cv/application-registry-entity` owns the TS-first Drizzle
schema, inferred models, and generated migrations;
`@cv/application-registry-crud` owns direct persistence;
`@cv/application-registry-service` owns registry workflows;
`@cv/application-registry-fx` owns currency rates and conversion;
`@cv/application-registry-api-contract` owns the Effect HttpApi; and
`@cv/application-registry-api-client` owns the generated client. Clients never
connect to D1 directly.

## Architecture

- One Effect `HttpApi` declaration defines the authenticated routes and OpenAPI
  3.1 document and is also the source of the generated Effect client.
- The entity package owns the split Drizzle table definitions, inferred types,
  Drizzle-derived Effect codecs, and generated migration history.
- CRUD contracts are imported from `@cv/application-registry-crud`; only this
  runtime composition root imports their D1 implementations from
  `@cv/application-registry-crud/live`.
- Registry service contracts are imported from
  `@cv/application-registry-service`; only the composition root installs the
  implementations from `@cv/application-registry-service/live`.
- The official `drizzle-orm/effect-d1` adapter runs normal reads through
  `@effect/sql-d1`.
- D1's native `batch()` API is used only by plain persistence helpers for
  multi-statement writes. `@effect/sql-d1` deliberately does not emulate D1
  transactions; one D1 batch keeps each aggregate write and operation receipt
  atomic.
- Event rows retain history while the `applications` row is the current
  searchable projection.
- D1 assigns a monotonic revision inside each mutation batch. Application and
  global-event cursors use revisions rather than client timestamps or UUID
  ordering, so delayed and same-millisecond writes cannot fall behind a saved
  cursor.
- Operation receipts make outbox replay safe, including when a write committed
  but its HTTP response was lost. A canonical operation request signature
  prevents one operation ID from being reused with different content.

The database contains applications, labels, notes, events, campaign captures,
structured compensation, exchange-rate observations, and operation receipts.
Clients supply one stable `operationId` for capture/event/note replay. The
server owns ordinary UUID generation for entity IDs; monotonic database
revisions, rather than UUID ordering, power synchronization.

## API

`GET /health` is public. All `/v1/*` routes require
`Authorization: Bearer <REGISTRY_API_TOKEN>`.
`GET /openapi.json` exposes the OpenAPI document generated from the same
declaration used by handlers and the internal Effect client.

- `PUT /v1/applications`: upsert a registry projection by job key.
- `POST /v1/captures`: atomically create/update an application, append its
  `campaign_prepared` event, and store the generated campaign capture.
- `GET /v1/applications`: cursor-paginated application table data. Each row
  includes labels, a compensation summary, follow-up state, latest event
  metadata, and note/capture counts. `currency=USD` (or another ISO code)
  converts the displayed summary; `currency=original` leaves it unchanged.
  Filters cover company, role,
  location, one or more lifecycle statuses, target stages, priorities, labels,
  follow-up states, and exact canonical URL.
- `GET /v1/applications/facets`: sorted observed companies, statuses, target
  stages, priorities, and labels for dashboard controls.
- `GET /v1/applications/:id`: fetch by application ID or exact job key.
- `PATCH /v1/applications/:id`: update research and lifecycle fields.
- `DELETE /v1/applications/:id`: remove an application aggregate.
- `GET /v1/applications/:id/captures`: recover campaign submission details and
  artifact metadata stored for the application.
- `GET /v1/applications/:id/compensations`: return original compensation and,
  when `currency=USD` (or another ISO code) is supplied, converted minor-unit
  bounds with the exact rate observation used.
- `GET /v1/applications/:id/events`: fetch an application's event history.
- `POST /v1/applications/:id/events`: append a lifecycle, contact, follow-up,
  or research history event. Status-changing kinds require an explicit
  `nextApplicationStatus`; informational kinds omit it.
- `GET /v1/applications/:id/annotations`: fetch labels and notes.
- `GET|PUT /v1/applications/:id/labels`: read or replace labels.
- `POST /v1/applications/:id/notes`: atomically append a typed registry note,
  its history event, and an idempotency receipt.
- `GET /v1/events`: cursor-paginated global event feed with application company,
  role, and canonical URL context. `from` and `to` bound source event time
  inclusively; `kind` accepts one or more event kinds.

Idempotent capture, event, and note requests include one `operationId`.
Event writes may include `expectedVersion` for optimistic concurrency; a stale
version returns HTTP 409.
The service never infers projection status from an event name. `submitted`,
`stage_changed`, `interview_scheduled`, `rejected`, `withdrawn`, and
`offer_received` therefore require `nextApplicationStatus`. `note_added`,
`contact_logged`, `follow_up_scheduled`, and `research_updated` preserve the
current status and omit that field.
Operation receipts bind that ID to the canonical request, so reuse for another
operation or payload returns HTTP 409. `occurredAt` and `capturedAt` retain
source history; server time owns `recordedAt` and projection timestamps.
Persisted timestamps use canonical UTC ISO strings.

The existing `/v1` API is also the Grafana data source contract; Grafana uses
the same `REGISTRY_API_TOKEN` as other clients. There is no separate dashboard
adapter or Grafana-only route family. Numeric `limit` values remain restricted
to 1–100 (default 50); clients follow `nextCursor` by passing it back as `after`
until it becomes `null`.

Compensation is stored in its original currency and integer minor units. The
conversion endpoint reuses a rate fetched within the preceding 24 hours and
otherwise refreshes the pair from Frankfurter's public API. A bounded Effect
cache shares rates within a Worker isolate, while D1 shares observations across
isolates. The provider's observation date and our cache-fetch time are stored
separately. Converted values are derived output, never a replacement for the
source amount.

`GET /v1/events` is the lifecycle/audit feed, not a universal replica change
log. Its revision cursor is a lossless checkpoint for registry events.
Application list cursors use `updatedRevision` and also advance for aggregate
label and note mutations. Numeric page traversal uses `nextCursor`; durable
incremental sync uses the separate `checkpoint`, including after a final page.
The checkpoint identifies the last returned revision or preserves `after` when
no row matches. Hard deletes intentionally do not emit tombstones.

## Local development

Install dependencies from the repository root, apply the checked-in migration,
then start Wrangler:

```bash
bun install
bunx nx run application-registry-api:migrations:apply:local
bunx nx run application-registry-api:dev
```

The local `wrangler.jsonc` binds `APPLICATION_REGISTRY_DB`. Set the local Worker
secret before testing authenticated routes:

```bash
cd apps/application-registry-api
printf '%s' 'local-registry-token' | node ../../node_modules/wrangler/bin/wrangler.js secret put REGISTRY_API_TOKEN --local
```

After changing a table under `libs/application-registry/entity/src/tables`,
generate and inspect the D1-owned migration:

```bash
bunx nx run application-registry-entity:migrations:generate
bunx nx run application-registry-entity:migrations:check
```

Migration generation and history checking belong to
`libs/application-registry/entity`; applying that history belongs to this app
because Wrangler needs the concrete Worker binding and local/remote target.

Useful verification commands:

```bash
bunx nx run application-registry-api:typecheck
bunx nx run application-registry-entity:migrations:check
bunx nx run application-registry-crud:test:integration
bunx nx run application-registry-service:test:unit
bunx nx run application-registry-service:test:integration
bunx nx run application-registry-fx:test:unit
bunx nx run application-registry-api:test:unit
bunx nx run application-registry-api:test:integration
bunx nx run application-registry-api:test:e2e
bunx nx run application-registry-api:build
```

The integration and end-to-end suites require no Docker daemon:

- `libs/application-registry/crud/test` verifies the D1 CRUD Layers directly
  against a Miniflare D1 binding.
- `libs/application-registry/service/test` verifies live workflows over the same
  D1 implementation while supplying non-network test dependencies through
  Effect Layers. Business concurrency, idempotency, merge, lifecycle, rollback,
  and checkpoint scenarios belong there.
- `apps/application-registry-api/test/application-registry.integration.test.ts`
  is intentionally limited to the live HTTP boundary: authentication, request
  decoding, and service-error-to-status routing against Miniflare D1.
- `apps/application-registry-api/test/application-registry.e2e.test.ts` executes
  the built Worker and verifies persistence after recreating it against the same
  database directory.

## Production deployment

Terraform creates the D1 database, manages the dedicated `workers.dev` exposure
resource, and writes derived Infisical values. Wrangler owns Worker creation,
deployed code, observability configuration, the D1 binding, migrations, and
`REGISTRY_API_TOKEN` secret while preserving that exposure setting.

Required deployment environment:

- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_API_TOKEN`
- `APPLICATION_REGISTRY_DB_ID`
- `APPLICATION_REGISTRY_DB_NAME`
- `APPLICATION_REGISTRY_WORKER_NAME`
- `REGISTRY_API_TOKEN`
- `APPLICATION_REGISTRY_COMPATIBILITY_DATE`, optional

Apply in this order after Terraform:

```bash
bunx nx run application-registry-api:migrations:apply:remote
bunx nx run application-registry-api:deploy
```

The deploy target requires `REGISTRY_API_TOKEN` and publishes the Worker code
and bearer secret together through Wrangler's `--secrets-file` deployment. The
production GitHub workflow performs the same build, migration, and atomic
deployment sequence. D1 migrations are forward-only; inspect generated SQL and
use D1 Time Travel for operational recovery rather than editing an applied
migration.

The two app-owned deployment scripts are deliberately thin infrastructure
adapters. `scripts/write-wrangler-config.ts` materializes the environment's
Worker name and D1 binding. `scripts/deploy.ts` writes `REGISTRY_API_TOKEN` to a
temporary Wrangler `--secrets-file`, invokes `wrangler deploy`, and removes the
temporary file. Neither script owns registry behavior or migration generation.

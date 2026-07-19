# Application registry API

Cloudflare Worker for the personal application registry and CV preparation
product. It serves the management SPA, its same-origin BFF, the Login with
ChatGPT subscription proxy, the authenticated registry API, the internal public
CV resolver, and the producer boundary for asynchronous PDF jobs. D1 is the
relational system of record while private opaque bytes live in R2.

`@cv/application-registry-entity` owns the TS-first Drizzle schema, inferred
models, and generated migrations;
`@cv/application-registry-crud` owns direct persistence;
`@cv/application-registry-service` owns registry workflows;
`@cv/application-registry-fx` owns currency rates and conversion;
`@cv/application-registry-api-contract` owns the Effect HttpApi; and
`@cv/application-registry-api-client` owns the generated client. Clients never
connect to D1 directly.

## Architecture

- One Effect `HttpApi` declaration defines the authenticated routes and OpenAPI
  3.1 document and is also the source of the generated Effect client. Effect
  4.0.0-beta.99 supplies immutable composition and handler hardening; the
  registry uses an exhaustive `handleAll` object plus a declaration-time guard
  for duplicate endpoint identifiers and method/path operations.
- Static Assets serves the management SPA. `/api/registry/*` is a same-origin
  BFF that injects `REGISTRY_API_TOKEN` inside the Worker; Cloudflare Access must
  protect this browser surface in production.
- `/api/chatgpt/*` delegates to `@opencoredev/loginwithchatgpt-server`. Encrypted
  auth sessions and short-lived proxy counters live in Workers KV. Draft prompt
  and conversation state remain browser-owned and transient.
- The exported `CvPublicResolver` named entrypoint is the only public-renderer
  read boundary. `cv-public` calls it through a one-way service binding, so the
  public Worker never receives a registry bearer token.
- Starting a PDF job atomically creates the pending artifact and a D1 outbox
  row. The API immediately attempts to publish its versioned message through
  `CV_PDF_QUEUE`; a five-minute cron redispatches undispatched outbox rows after
  crashes or transient Queue failures. `cv-pdf-worker` owns Browser Rendering,
  exact-public-URL rendering, retries, and the dead-letter consumer. No
  Puppeteer or filesystem compatibility shim is bundled into this Worker.
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
- Event rows retain history while the deliberately small `applications` row is
  the current searchable projection.
- Listing-check rows retain HTTP/provider evidence while the application row
  stores the current availability projection. A separate schedule table uses
  bounded leases and retry backoff so overlapping cron invocations do not
  process the same due item.
- D1 assigns a monotonic revision inside each mutation batch. Application and
  global-event lists use revisions for deterministic ordering rather than
  relying on client timestamps or UUID ordering.
- Operation receipts make outbox replay safe, including when a write committed
  but its HTTP response was lost. A canonical operation request signature
  prevents one operation ID from being reused with different content.

## Persistence boundaries

The current application projection contains source identity (`jobKey`, source
job ID, canonical URL), company, role, optional location, lifecycle status,
target stage, optional personal priority and follow-up/contact timestamps, the
listing-availability projection, optimistic `version`, revisions, and audit
timestamps. Fit score, category, remote policy, free-form details, open status,
source confidence, technology stack, recommended action, and research priority
are no longer application columns.

Related D1 tables contain labels, notes, events, structured compensation,
exchange-rate observations, listing evidence/schedules, job-snapshot metadata,
facts release manifests/channels, content-entry and revision metadata, public
links, generated-artifact metadata, and operation receipts. Campaign captures
remain readable for historical compatibility, but v2 preparation uses job
snapshots and content revisions instead of adding more fields to the
application row.

Facts catalogues/assets, raw and normalized job snapshots, CV and cover-letter
revision payloads, and PDFs are opaque R2 objects. D1 records only object keys,
hashes, byte lengths, media types, contract identifiers/versions, ownership,
and lifecycle relations. This backend does not inspect document or facts
payload fields. The management frontend, facts compiler, and public renderer
own those code-defined contracts and validate payload shape at their respective
boundaries. Content locales use normalized locale identifiers, and the active
facts release reports its complete locale list from the authored facts config.

Clients supply one stable `operationId` for event, note, managed
update, and content-revision replay where the contract requires it. The server
owns ordinary UUID generation for entity IDs; monotonic database revisions,
rather than UUID ordering, provide stable list ordering and an ordinary
filterable change marker.

## HTTP surfaces

`GET /health` is public. All `/v1/*` routes require
`Authorization: Bearer <REGISTRY_API_TOKEN>`.
`GET /openapi.json` exposes the OpenAPI document generated from the same
declaration used by handlers and the internal Effect client.

The production Cloudflare Access configuration protects the management SPA,
`/api/registry/*`, and `/api/chatgpt/*` for the single configured owner email.
It gives `/v1/*` a more-specific Access bypass because those machine routes
still enforce their own bearer token. `/api/registry/*` strips that prefix,
forwards to the corresponding registry route, and adds the bearer token without
exposing it to browser JavaScript.

### Applications and history

- `POST /v1/applications`: create a registry projection and return conflict when
  its job key already exists.
- `PUT /v1/applications`: explicitly upsert a registry projection by job key.
- `GET /v1/applications`: cursor-paginated application table data. Each row
  includes labels, a compensation summary, follow-up time, latest event
  metadata, and a note count. Related values are nested as `latestEvent` and
  `counts` rather than exposed as SQL-projection aliases.
  `currency=USD` (or another ISO code) converts the displayed summary;
  `currency=original` leaves it unchanged.
  The definition exposes scalar columns, relations, counts, latest-value
  expressions, and cross-field search for generic filtering and ordering.
- `GET /v1/applications/facets`: sorted observed companies and labels for
  dashboard controls. Closed enum choices come from the shared query metadata.
- `GET /v1/applications/:id`: fetch by application ID or exact job key.
- `PATCH /v1/applications/:id`: update source identity, planning, and lifecycle
  fields with optional optimistic version checking.
- `PATCH /v1/applications/:id/management`: atomically update management-editable
  fields and, when present, replace labels and annual compensation. It requires
  `expectedVersion` and an idempotent `operationId`; a status transition also
  appends the server-selected lifecycle event in the same revision and version
  transition.
- `DELETE /v1/applications/:id`: remove an application aggregate, optionally
  guarded by `expectedVersion`.
- `GET /v1/analytics/cv-links`: aggregate Cloudflare traffic for the registry's
  published CV links over a 1, 3, or 7 day window and join it to application,
  content-entry, label, and link metadata.
- `GET /v1/applications/:id/compensations`: return original compensation and,
  when `currency=USD` (or another ISO code) is supplied, converted minor-unit
  bounds with the exact rate observation used.
- `PUT /v1/applications/:id/annual-compensation`: replace the annual value
  selected for table display in its original currency, guarded by a required
  `expectedVersion`.
- `GET /v1/applications/:id/events`: fetch an application's event history.
- `POST /v1/applications/:id/events`: append a lifecycle, contact, follow-up,
  or research history event. Status-changing kinds require an explicit
  `nextApplicationStatus`; informational kinds omit it.
- `GET /v1/applications/:id/annotations`: fetch labels and notes.
- `GET|PUT /v1/applications/:id/labels`: read or replace labels. Management UI
  writes include `expectedVersion` so a stale replacement returns HTTP 409.
- `POST /v1/applications/:id/notes`: atomically append a typed registry note,
  its history event, and an idempotency receipt.
- `GET /v1/events`: cursor-paginated global event feed with application company,
  role, and canonical URL context. Its generic fields include event kind,
  revision, source/recorded timestamps, IDs, device, and operation.
- `GET /v1/applications/:id/listing-checks`: return stored listing-check
  evidence and decisions newest first.
- `PUT /v1/applications/:id/listing-availability`: resolve a listing finding
  against the server policy and persist the resulting projection/event.
- `POST /v1/listing-check-findings`: idempotently ingest a bounded batch of
  observations produced by the local CLI. This endpoint never fetches a job
  page; it validates targets and applies server-owned policy and persistence.
- `GET /v1/listing-check-runs/:id`: return a persisted run summary.

### Job context, facts, and opaque content

- `POST /v1/applications/:id/job-snapshots/capture`: fetch the application's
  canonical HTTP(S) posting URL on the server, follow bounded redirects, and
  persist a success or failure snapshot. Responses are streamed with a 4 MiB
  limit and a 20-second capture timeout. Successful ordinary HTML captures keep
  the exact raw response and also derive bounded, deterministic plain text from
  the page title, metadata, JSON-LD, and visible body text. Effect Schema
  accepts only credential-free HTTP(S) URLs; redirects are checked by the same
  schema and bounded to five hops. The capture also enforces redirect-loop,
  response-size, and timeout limits without maintaining a hand-written IP
  parser.
- `POST /v1/applications/:id/job-snapshots`: persist a caller-provided raw
  and/or normalized snapshot, including an explicit failure record. The
  management app uses this opaque boundary to save a corrected or pasted role
  and requirements snapshot without mutating the original raw capture.
- `GET /v1/applications/:id/job-snapshots/latest` and
  `GET /v1/applications/:id/job-snapshots/:snapshotId`: read snapshot metadata.
- `GET /v1/applications/:id/job-snapshots/:snapshotId/payloads/:kind`: read the
  opaque `raw` or `normalized` payload.
- `POST /v1/objects`: store opaque bytes and return their content-addressed R2
  reference. The facts release publisher uses this before registration.
- `POST /v1/facts-releases`: register immutable exact-SHA release metadata.
- `GET /v1/facts-releases/:releaseId`: read one registered release.
- `PUT /v1/facts-releases/channels/:channel`: atomically activate a registered
  release with optimistic channel versioning.
- `GET /v1/facts-releases/active`: return the active catalogue and assets for
  the requested channel and locale, together with the release's available
  locale list.
- `POST /v1/applications/:id/content-entries`: idempotently ensure the one
  `cv` or `cover_letter` entry for the application, kind, and requested locale.
- `GET /v1/applications/:id/content-entries/:entryId`: read entry metadata.
- `GET|POST /v1/applications/:id/content-entries/:entryId/revisions`: list
  revisions or append an opaque AI/human revision pinned to optional facts and
  job-snapshot inputs.
- `GET /v1/applications/:id/content-entries/:entryId/revisions/:revisionId`:
  read revision metadata and opaque bytes.
- `POST /v1/applications/:id/content-entries/:entryId/approval`: select a
  revision as the approved head with optimistic version checking.

### CV publication and PDF artifacts

- `POST|GET /v1/applications/:id/content-entries/:entryId/publication`: create
  or read the stable public link for an approved CV revision. Its bearer token
  remains valid until the link is disabled; republishing the entry retains the
  token.
- `PUT /v1/applications/:id/content-entries/:entryId/publication/availability`:
  disable or re-enable that link. Rejecting an application disables all its CV
  links with a system reason; reopening restores only links disabled for that
  reason.
- `POST /v1/applications/:id/cv-links/disable`: explicitly disable every CV link
  for an application.
- `POST /v1/applications/:id/content-entries/:entryId/pdf-jobs`: atomically
  create/reuse a pending artifact by `requestId` and enqueue its versioned job.
- `GET /v1/applications/:id/content-entries/:entryId/pdf-jobs/:jobId`: read the
  artifact-backed job status (`pending`, `ready`, or `failed`).
- `GET /v1/applications/:id/content-entries/:entryId/pdf-artifacts/current` and
  its `/content` child: read current artifact metadata or the ready PDF.
The queue consumer calls the registry service directly over its own D1/R2
bindings; there are no public completion/failure endpoints. Failed rendering,
including a one-page overflow, records the failure and disables the incomplete
publication. The management product only presents a publication as ready after
the exact-URL PDF is stored.

The named `CvPublicResolver` accepts only internal service-binding requests at
`/cv-publications/:token`. It returns enabled opaque CV bytes plus digest and
contract metadata with `private, no-store`; the schema-owning public Worker
validates and renders those bytes at `/c/:token`.

The shared checker prefers authoritative provider APIs for Greenhouse and
Lever, then uses the fetched page's status, redirects, matching JobPosting JSON-LD,
`validThrough`, explicit closure wording, and a working apply action. HTTP 410
and provider API removal are confirmed closure signals. A 404, expired
`validThrough`, or matching closure text first creates a suspected-closed
candidate and is rechecked after its grace window. Authentication, rate limits,
server failures, network failures, redirects to generic pages, and identity
mismatches without a replacement posting remain unknown/review signals and
never archive a listing. When the same URL clearly advertises and accepts
applications for a materially different role, the original listing becomes a
suspected-closed candidate and still has to pass its confirmation window.

Archive mode is constrained twice: policy only recommends it for
`not_started`/`preparing` applications, and the D1 update checks the status
again atomically. Report mode still records evidence, updates availability,
and schedules the next check, but never changes the application lifecycle.

Idempotent event and note requests include one `operationId`.
Event writes may include `expectedVersion` for optimistic concurrency; a stale
version returns HTTP 409.
The service never infers projection status from an event name. `submitted`,
`stage_changed`, `interview_scheduled`, `rejected`, `withdrawn`, and
`offer_received` therefore require `nextApplicationStatus`. `note_added`,
`contact_logged`, `follow_up_scheduled`, and `research_updated` preserve the
current status and omit that field.
Operation receipts bind that ID to the canonical request, so reuse for another
operation or payload returns HTTP 409. `occurredAt` retains source history;
server time owns `recordedAt` and projection timestamps.
Persisted timestamps use canonical UTC ISO strings. SQLite, and therefore D1,
has no native timestamp storage class; lexicographically sortable ISO text
keeps the representation portable while Effect schemas enforce the boundary
format.

The existing `/v1` API is also the data source for the browser management app's
analytics dashboard. There is no separate dashboard adapter or route family.
List GETs encode generic filter and order arrays as JSON in `filters` and
`orderBy`; pagination uses flat `after` and `size` query parameters, while
application full-text search remains the flat `q` parameter. The browser
management app and the Worker both use the concrete contract codec for this
format instead of maintaining separate serializers.
Numeric sizes remain restricted to 1–100 (default 50), and clients follow
`pageInfo.nextCursor` until it becomes `null`. Before D1 execution, list queries
whose final compiled statement exceeds D1's
[100-bound-parameter budget](https://developers.cloudflare.com/d1/platform/limits/)
are reported as HTTP 400 with an actionable query-complexity error rather than
an opaque database failure.

Compensation is stored in its original currency and integer minor units. The
conversion endpoint reuses a rate fetched within the preceding 24 hours and
otherwise refreshes the pair from Frankfurter's public API. A bounded Effect
cache shares rates within a Worker isolate, while D1 shares observations across
isolates. The provider's observation date and our cache-fetch time are stored
separately. Converted values are derived output, never a replacement for the
source amount.

`GET /v1/events` is the lifecycle/audit feed, not a universal replica change
log. Event `revision` and application `updatedRevision` are ordinary sortable,
filterable fields. A consumer can request rows after a known revision with a
`gt` filter and ascending revision ordering, but this is not a separate durable
replication protocol: responses are ordinary query pages and hard deletes do
not emit tombstones. Follow-up categories are likewise expressed with ordinary
`followUpAt` filters: `isNull` for no scheduled follow-up, or timestamp range
operators such as `lt` and `gte` against a reference time chosen by the client.

## Local development

Install dependencies from the repository root, apply the checked-in migration,
then start Wrangler:

```bash
bun install
bunx nx run application-registry-api:migrations:apply:local
bunx nx run application-registry-api:dev
```

The local `wrangler.jsonc` binds D1 as `APPLICATION_REGISTRY_DB`, R2 as
`CV_OBJECTS`, Workers KV as `CHATGPT_SESSIONS`, and the PDF producer as
`CV_PDF_QUEUE`. Browser Rendering and both Queue consumers are owned by
`apps/cv-pdf-worker/wrangler.jsonc`. Set both local registry Worker secrets
before testing the BFF or ChatGPT flow:

```bash
cd apps/application-registry-api
printf '%s' 'local-registry-token' | node ../../node_modules/wrangler/bin/wrangler.js secret put REGISTRY_API_TOKEN --local
printf '%s' 'local-chatgpt-session-secret' | node ../../node_modules/wrangler/bin/wrangler.js secret put CHATGPT_SESSION_SECRET --local
printf '%s' 'local-analytics-token' | node ../../node_modules/wrangler/bin/wrangler.js secret put CLOUDFLARE_ANALYTICS_API_TOKEN --local
```

The management Vite build reads `VITE_CV_PUBLIC_BASE_URL`; production sets it
to `https://<CV_WEB_HOST>/c`. The Login with ChatGPT flow uses the owner's
existing subscription through `/api/chatgpt/*`; there is intentionally no
OpenAI API key configuration.

Worker secrets and scheduled-listing settings are decoded at Effect boundaries
with `Config` and `Schema`; handlers receive typed services rather than reading,
trimming, or parsing `env` ad hoc. The outer Cloudflare `fetch`/`scheduled`
methods remain Promise adapters because that is the platform interface.

Wrangler config installs a five-minute PDF-outbox dispatcher and an hourly
listing-check cron at minute 17. The listing handler is report-only by default
and uses a batch size of five. Its plain-text Worker variables are:

- `LISTING_CHECKS_ENABLED`: set to `false` to make the handler a no-op.
- `LISTING_CHECK_ARCHIVE_ENABLED`: set to `true` to permit policy-approved
  archival; the checked-in default is `false`.
- `LISTING_CHECK_BATCH_SIZE`: integer batch size, capped at 10.

These defaults keep the scheduled workload small and compatible with the same
Worker/D1 deployment; no separate scheduler service is required.

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

Their Miniflare lifecycle, bindings, migrations, reset helpers, deterministic
factories, and bulk seeders live in
`@cv/worker-test-kit/application-registry`. Only the API's built bundle path and
scenario assertions remain app-owned.

- `libs/application-registry/crud/test` verifies the D1 CRUD Layers directly
  against a Miniflare D1 binding.
- `libs/application-registry/service/test` verifies live workflows over the same
  D1 implementation while supplying non-network test dependencies through
  Effect Layers. Business concurrency, idempotency, merge, lifecycle, rollback,
  revision filtering, and pagination scenarios belong there.
- `apps/application-registry-api/test/application-registry.integration.test.ts`
  is intentionally limited to the live HTTP boundary: authentication, request
  decoding, and service-error-to-status routing against Miniflare D1.
- `apps/application-registry-api/test/application-registry.e2e.test.ts` executes
  the built Worker and verifies persistence after recreating it against the same
  database directory.

## Production deployment

Terraform creates D1, the private R2 bucket, and the ChatGPT-session KV
namespace; provisions Cloudflare Access; manages the dedicated `workers.dev`
exposure resource; and writes derived Infisical values. Wrangler owns Worker
creation, deployed code and Static Assets, observability, D1/R2/KV/Browser Run
and Queue bindings, migrations, and runtime secrets while preserving that
exposure setting.

Required deployment environment:

- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_ANALYTICS_API_TOKEN`, restricted to analytics read access
- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ZONE_ID`
- `CV_WEB_HOST`, used to build the management application's public link base
- `APPLICATION_REGISTRY_DB_ID`
- `APPLICATION_REGISTRY_DB_NAME`
- `APPLICATION_REGISTRY_WORKER_NAME`
- `CHATGPT_SESSIONS_KV_ID`
- `CHATGPT_SESSION_SECRET`
- `CV_OBJECTS_BUCKET_NAME`
- `REGISTRY_API_TOKEN`
- `APPLICATION_REGISTRY_WORKERS_DEV_ENABLED`, Terraform-synced after Access is
  attached; defaults to `false` during the initial private bootstrap
- `CV_PDF_QUEUE_NAME`, optional, defaults to `cv-pdf-generation`
- `CV_PDF_DLQ_NAME`, optional, defaults to `cv-pdf-generation-dead-letter`
- `CV_PDF_WORKER_NAME`, optional, defaults to `cv-pdf-worker`
- `APPLICATION_REGISTRY_COMPATIBILITY_DATE`, optional

After Terraform has bootstrapped D1, R2, and KV as described in
`terraform/README.md`, build the management assets and deploy in this order:

```bash
VITE_CV_PUBLIC_BASE_URL="https://${CV_WEB_HOST}/c" \
bunx nx run application-registry-management:build
bunx nx run application-registry-api:migrations:apply:remote
bunx nx run cv-pdf-worker:deploy
bunx nx run application-registry-api:deploy
```

The deploy target requires `REGISTRY_API_TOKEN`, `CHATGPT_SESSION_SECRET`, and
`CLOUDFLARE_ANALYTICS_API_TOKEN` and publishes the registry Worker, management assets, all three secrets, and
resource bindings through Wrangler's `--secrets-file` deployment. The
deployment creates both queues before publishing the Queue consumer and
producer Workers.
On the initial deployment, `APPLICATION_REGISTRY_WORKERS_DEV_ENABLED` is absent
and the generator emits `workers_dev: false`, so the management UI and its
bearer-injecting BFF cannot become public before Access. The full Terraform
apply attaches Access, enables the hostname, and syncs the flag as `true` for
later deployments.
The production GitHub workflow first builds the management SPA with the final
`CV_WEB_HOST/c` public base URL, then performs the same build, migration, and
atomic deployment sequence. D1 migrations are forward-only; inspect generated
SQL and use D1 Time Travel for operational recovery rather than editing an
applied migration.

The two app-owned deployment scripts are deliberately thin infrastructure
adapters. `scripts/write-wrangler-config.ts` materializes the environment's
Worker name, Terraform-owned exposure state, D1/R2/KV bindings, and the private
PDF Queue producer binding. The sibling PDF app owns Browser Rendering and
Queue consumer configuration. `scripts/deploy.ts`
writes `REGISTRY_API_TOKEN`, `CHATGPT_SESSION_SECRET`, and
`CLOUDFLARE_ANALYTICS_API_TOKEN` to a temporary Wrangler
`--secrets-file`, invokes `wrangler deploy`, and removes the temporary file.
Neither script owns registry behavior or migration generation.

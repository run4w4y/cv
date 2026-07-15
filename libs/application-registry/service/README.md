# Application registry service

Slice-oriented Effect services for registry workflows. The package root exports
stable service interfaces, Context keys, inputs, outputs, and errors. Consumers
can build programs entirely against those contracts. Concrete workflow Layers
are available separately from `@cv/application-registry-service/live` and are
installed only by runtime composition roots.

This package owns replay and conflict handling, explicit status transitions,
and coordination across CRUD and FX services. List requests use the shared
query definitions and their pagination implementation; this package contains
no HTTP, D1, or Drizzle implementation concerns.

Idempotent commands store a canonical operation request signature with their
receipt. Reusing an operation ID with the same request safely replays its
result; reusing it for different content is rejected instead of silently
returning the first command's result.

The public services are split by registry slice:

- `ApplicationsService` owns application upsert, patch, lookup, deletion,
  cursor pagination, dashboard row decoration and facets, plus label
  replacement on an application.
- `AnnotationsService` owns annotation lookup and idempotent note creation.
- `CapturesService` owns idempotent campaign capture ingestion.
- `EventsService` owns idempotent event append and cursor pagination.
- `CompensationsService` owns original and converted compensation views.
- `ListingChecksService` owns idempotent local-finding ingestion, internal
  scheduled runs, grace windows, lifecycle safeguards, and listing-check
  history.

`ListingAvailabilityChecker` lives in the runtime-neutral
`@cv/application-registry-listing-check` package. Both the local Bun CLI and the
internal Worker scheduler use its provider and bounded-page strategies. This
service owns the durable decision: target validation, target-stage cadence,
suspected-closed confirmation windows, safe archival eligibility, leases, and
failure backoff all remain server-side.

Both global list services accept the generic definition-derived request shape
and return ordinary `{ items, pageInfo }` query pages.
`pageInfo.nextCursor` continues the same filtered and ordered traversal through
`pagination.after`. Numeric page sizes default to 50 and are capped at 100.

Revision-based reads do not have a separate service protocol. Applications can
be filtered with `updatedRevision gt <revision>` and ordered by
`updatedRevision asc`; events expose the equivalent `revision` field. The
regular query model remains responsible for binding those filters and ordering
terms to the cursor.

The service returns the stored `followUpAt` timestamp without deriving a
request-time follow-up category. Consumers can express those categories with
ordinary filters: `isNull` for no follow-up, `lt <reference-time>` for overdue,
and `gte <reference-time>` for upcoming. The consumer chooses the reference
time and must keep it stable while following cursors through one traversal.
Application listing still formats stored minor-unit compensation into a concise
original-currency summary.

Application rows retain the entity's natural nested shape: `counts` groups
capture and note totals, while `latestEvent` and `latestCapture` are nullable
objects. The service adds the requested compensation presentation without
flattening persistence relations into a set of unrelated scalar aliases.

Event status changes are explicit. Status-changing kinds (`submitted`,
`stage_changed`, `interview_scheduled`, `rejected`, `withdrawn`, and
`offer_received`) carry `nextApplicationStatus`; the service passes that value
to the atomic projection/event write. Informational kinds (`note_added`,
`contact_logged`, `follow_up_scheduled`, and `research_updated`) omit it and
leave the projection status unchanged. No event-name-to-status conversion is
hidden in the service.

Unit tests live beside the `/live` implementations and replace CRUD and FX
dependencies with `Layer.succeed` fakes. `test/service.integration.test.ts`
composes a managed Effect runtime from the live services, the real CRUD layer,
and Miniflare's direct D1 proxy, without an HTTP test Worker, a browser bundle,
or network FX requests. The integration suite owns workflow-level coverage for
idempotency and operation conflicts, concurrent job-key
convergence, capture merge policy, database defaults, nullable patches,
optimistic races, explicit lifecycle transitions, atomic rollback, and
ordinary filtered and cursor-paginated listing.

```bash
bunx nx run application-registry-service:test:unit
bunx nx run application-registry-service:test:integration
```

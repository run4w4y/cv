# Application registry CRUD

Effect contracts for direct application-registry persistence. Business
workflows live in `@cv/application-registry-service`; this package owns query
construction, database outcomes, and the D1 batches required to persist one
registry operation without partial writes.

The root `@cv/application-registry-crud` entry point exports named service
interfaces, Context tags, errors, and persistence input types. The contracts
are split by data-plane slice: applications, annotations, captures,
compensations, events, FX rates, and operation receipts. Implementations are
deliberately separate:

- `@cv/application-registry-crud/live` exports one D1 live-layer factory for
  every CRUD slice. It accepts the request-local binding as an Effect instead
  of exposing another database service.
- `@cv/application-registry-crud/test-support` exports the reusable Miniflare
  D1 harness used by package-owned integration suites.

This separation lets services and unit tests depend on stable CRUD shapes and
provide fakes with `Layer.succeed`, while only runtime composition roots import
the live adapter. Effect Drizzle and raw Drizzle connections are constructed
inside that adapter. Raw D1 access remains private to the few multi-statement
writes that require an atomic D1 batch.

Those batches are persistence invariants, not business workflows. A capture,
event, or note write may update the application projection, allocate a revision,
append history, and record its idempotency receipt. Committing that set through
one D1 `batch()` prevents a partially visible operation; ordinary reads and
single-statement writes use Drizzle's query API.

Application list enrichment is also persistence-owned: the filtered page is
selected first, then labels, compensation, latest events, and child counts are
loaded in set-based queries for those application IDs. Filters are applied to
the projection before cursor pagination, so results and checkpoints are
consistent. Facet queries return sorted observed values rather than a second
dashboard-specific representation.

`test/crud.integration.test.ts` exercises the live layer against a real local
D1 binding supplied by Miniflare. `@cv/application-registry-crud/test-support`
exposes that binding directly through Miniflare's `getD1Database()` proxy; the
tests invoke Effect services without an HTTP test Worker or generated browser
bundle. Higher-level package tests reuse the same harness. This suite also owns
database-only invariants such as migrated foreign keys and child cascades. No
Docker daemon is required.

```bash
bunx nx run application-registry-crud:test:integration
```

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

- `@cv/application-registry-crud/d1` exports the Effect Drizzle/D1 database
  layer and the D1 implementations of every CRUD slice.
- `@cv/application-registry-crud/test-support` exports the reusable Miniflare
  D1 harness used by package-owned integration suites.

This separation lets services and unit tests depend on stable CRUD shapes and
provide fakes with `Layer.succeed`, while only runtime composition roots import
the D1 layers. The official Effect Drizzle database is constructed once per
provided database layer. Raw D1 Drizzle access remains internal to the few
multi-statement writes that require an atomic D1 batch.

Those batches are persistence invariants, not business workflows. A capture,
event, or note write may update the application projection, allocate a revision,
append history, and record its idempotency receipt. Committing that set through
one D1 `batch()` prevents a partially visible operation; ordinary reads and
single-statement writes use Drizzle's query API.

`test/crud.integration.test.ts` exercises the `/d1` Layers against a real local
D1 binding supplied by Miniflare. `@cv/application-registry-crud/test-support`
exposes the same harness to higher-level package tests. This suite also owns
database-only invariants such as migrated foreign keys and child cascades. No
Docker daemon is required.

```bash
bunx nx run application-registry-crud:test:integration
```

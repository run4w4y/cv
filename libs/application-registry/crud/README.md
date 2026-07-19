# Application registry CRUD

Effect persistence ports and D1 implementations for the registry. Business
workflows live in `@cv/application-registry-service`; this package owns query
execution, database outcomes, and atomic D1 batches.

Slices cover applications, annotations, activities, compensation, listing
checks, content, publications, PDF artifacts, FX rates, and idempotency
receipts. `@cv/application-registry-crud/live` composes the request-local D1
binding without exposing raw database access to service consumers.

Application create, aggregate update, note creation, and listing resolution
persist their projection changes, monotonic revision, backend activity, and
idempotency receipt atomically. This prevents partially visible workflows.

Application and activity lists compile the entity-owned `drizzle-query`
definitions directly. Application enrichment loads labels, compensation,
latest activity, and note count without defining a separate query contract.
Results retain nested `counts` and `latestActivity` shapes.

The integration suite runs against a real local Miniflare D1 binding and also
checks the intentional destructive schema migration from historical tables:

```bash
bunx nx run application-registry-crud:test:integration
```

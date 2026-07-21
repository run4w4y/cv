# Application registry CRUD

Effect persistence ports and PostgreSQL implementations for the registry. Business
workflows live in `@cv/application-registry-service`; this package owns query
execution, database outcomes, and transactions.

Slices cover applications, annotations, activities, compensation, listing
checks, content, publications, PDF artifacts, and idempotency receipts.
`@cv/application-registry-crud/live` composes a scoped Effect PostgreSQL client
without exposing raw database access to service consumers.

Application create, aggregate update, note creation, and listing resolution
persist their projection changes, monotonic revision, backend activity, and
idempotency receipt atomically. This prevents partially visible workflows.

Application and activity lists compile the entity-owned `drizzle-query`
definitions directly. Application enrichment loads labels, compensation,
latest activity, and note count without defining a separate query contract.
Results retain nested `counts` and `latestActivity` shapes.

The integration suite starts disposable PostgreSQL 17.5 containers to match the
Nomad deployment, applies the canonical baseline migration, and exercises the
real transaction and foreign-key behavior. Docker must be available locally:

```bash
bunx nx run application-registry-crud:test:integration
```

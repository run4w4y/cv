# Application registry entity

TS-first Drizzle tables and Drizzle-derived Effect codecs for the application
registry. This package is the sole physical-schema source of truth and owns the
D1 migrations generated from it.

The tables cover applications, labels, notes, events, campaign captures,
compensation entries, FX-rate observations, idempotency receipts, and the
monotonic revision sequence. Table row types are inferred directly from those
definitions; there is no hand-maintained duplicate entity interface.

`applications.remotePolicy` retains the source's short/raw work-policy text for
search and display. `applications.details.workMode` is the normalized shared
opportunity field used alongside the other geography-independent details.

The package separates the three concerns involved in the entity model:

- `src/model` owns reusable Effect leaf and structured-value schemas. Literal
  schemas supply the enum values used by the physical columns.
- `src/tables` owns SQLite names, columns, constraints, indexes, and foreign
  keys. `src/tables/index.ts` is Drizzle Kit's migration source.
- `src/codecs` uses the official `drizzle-orm/effect-schema` integration to
  derive select, insert, and update schemas from those tables. Explicit
  refinements are limited to domain constraints that Drizzle cannot infer from
  SQLite metadata, such as UTC timestamps and structured JSON.

The model also owns the appendable, status-changing, and informational event
kind subsets. The service types and HTTP union derive from those same values,
so lifecycle semantics cannot drift between the two boundaries.

The package root remains the public import surface. `src/schema.ts` is retained
only as a compatibility barrel for the existing `./schema` package export.

Drizzle Kit reads `src/tables/index.ts`. After a table change, generate and
inspect the migration, then verify that the checked-in history is current:

```bash
bunx nx run application-registry-entity:migrations:generate
bunx nx run application-registry-entity:migrations:check
```

Schema/codec unit coverage lives beside the public schema in
`src/schema.test.ts`. CI always runs the drift check before building the Worker.

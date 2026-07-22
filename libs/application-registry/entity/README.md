# Application registry entity

TS-first Drizzle tables and Drizzle-derived Effect codecs for the registry.
This package is the sole physical-schema source of truth and owns the PostgreSQL
migration history.

The current application model has one opaque text identity and one external
`postingUrl`. Keeping identifiers as text preserves the existing D1 records
during the one-time import; new identifiers can still use UUID values. Private
normalized URL and fingerprint columns support lookup and deduplication; there
are no public job keys, source IDs, or identity aliases.
Related tables cover labels, notes, backend-issued activities, compensation,
listing checks, opaque content revisions, publications, PDF
artifacts and idempotency receipts.

`content_revisions.facts_release_id` is provenance text, not a foreign key:
facts releases live as immutable static objects in the private object store and
have no registry tables.

Activities are descriptive history written by backend workflows. Their kinds,
actor, source, revision, time, and JSON payload are queryable, but they are not
client-authored lifecycle commands. Application status remains an ordinary
application field changed through the aggregate update workflow.

The package separates model concerns:

- `src/model` owns reusable constrained values and literal schemas;
- `src/tables` owns PostgreSQL columns, constraints, indexes, and foreign keys;
- `src/codecs` derives select/insert/update Effect schemas from Drizzle;
- `src/query` defines the authoritative `drizzle-query` filtering, ordering,
  computed fields, and cursor contracts shared by transport and persistence.

JSON columns are used only for values consumed as a whole, such as activity
details and listing evidence. Values used independently for filtering,
ordering, joins, or projection remain typed columns.
Compensation minor-unit amounts use PostgreSQL `bigint` while remaining bounded
to exact JavaScript safe integers at the codec boundary.

The PostgreSQL history starts with one clean baseline. Historical D1 migrations
are neither copied nor replayed. The one-shot migration tool reconstructs a
frozen D1 export at its supported final version and maps the data directly into
this final schema.

After changing tables, generate and inspect the migration and run the drift
check:

```bash
bunx nx run application-registry-entity:migrations:generate
bunx nx run application-registry-entity:migrations:check
```

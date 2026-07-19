# Application registry entity

TS-first Drizzle tables and Drizzle-derived Effect codecs for the registry.
This package is the sole physical-schema source of truth and owns the D1
migration history.

The current application model has one UUID identity and one external
`postingUrl`. Private normalized URL and fingerprint columns support lookup and
deduplication; there are no public job keys, source IDs, or identity aliases.
Related tables cover labels, notes, backend-issued activities, compensation,
listing checks, opaque content revisions, publications, PDF
artifacts, FX rates, and idempotency receipts.

`content_revisions.facts_release_id` is provenance text, not a foreign key:
facts releases live as immutable static objects in a dedicated private R2
bucket and have no registry tables.

Activities are descriptive history written by backend workflows. Their kinds,
actor, source, revision, time, and JSON payload are queryable, but they are not
client-authored lifecycle commands. Application status remains an ordinary
application field changed through the aggregate update workflow.

The package separates model concerns:

- `src/model` owns reusable constrained values and literal schemas;
- `src/tables` owns SQLite columns, constraints, indexes, and foreign keys;
- `src/codecs` derives select/insert/update Effect schemas from Drizzle;
- `src/query` defines the authoritative `drizzle-query` filtering, ordering,
  computed fields, and cursor contracts shared by transport and persistence.

JSON columns are used only for values consumed as a whole, such as activity
details and listing evidence. Values used independently for filtering,
ordering, joins, or projection remain typed columns.

The latest migration deliberately rebuilds the application model, migrates
existing application data into the UUID/posting-URL shape, converts useful
history into activities, and removes the old identity/event tables. The old
schema is not kept readable as a compatibility surface.

After changing tables, generate and inspect the migration and run the drift
check:

```bash
bunx nx run application-registry-entity:migrations:generate
bunx nx run application-registry-entity:migrations:check
```

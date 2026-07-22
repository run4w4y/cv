# D1 to PostgreSQL migration

One-time, offline importer for the application registry. PostgreSQL migrations
create only the clean final schema; this tool consumes a frozen D1 SQL export
and copies its final tables into an empty PostgreSQL database.

The source contract is deliberately exact. The export must contain the complete
15-migration history deployed to the live D1 database and precisely the final
registry tables, `d1_migrations`, and the retired `fx_rates` and
`pdf_generation_outbox` tables. Unknown, missing, or renamed migrations and
tables are rejected. Migration 16 is not supported because it was never
deployed.

Create the source artifact once. The deployed D1 registry is already
write-inactive, so no separate write-freeze step is required:

```bash
bunx wrangler d1 export "$APPLICATION_REGISTRY_DB_NAME" --remote --output .cv-work/application-registry/d1-export.sql
sha256sum .cv-work/application-registry/d1-export.sql
```

Run the importer through a local Consul Connect proxy (or another private
PostgreSQL endpoint):

```bash
export POSTGRES_HOST=127.0.0.1
export POSTGRES_PORT=15432
export POSTGRES_DATABASE=cv_registry
export POSTGRES_USER=cv_registry
export POSTGRES_PASSWORD=...
bunx nx run application-registry-migration:apply-schema
```

The schema command resolves the checked-in migration folder relative to its
own module, so it does not depend on the caller's working directory. It uses
Drizzle's migration journal and is safe to rerun. A successful invocation also
verifies that the complete `public` catalog exactly matches the clean registry
baseline. Before applying anything, it requires `public` to be empty or to
already match that baseline, preventing a wrong or partially initialized
database from being modified.

With the same PostgreSQL environment, run the importer:

```bash
bunx nx run application-registry-migration:import-d1 -- \
  --source .cv-work/application-registry/d1-export.sql \
  --sha256 <sha256-from-the-freeze-step>
```

The target must have the fresh PostgreSQL migration applied and every registry
table must be empty. Before reading or writing rows, the importer
fingerprints the complete PostgreSQL `public` catalog—tables, columns, types,
defaults, constraints, and indexes—and requires the exact fresh baseline. Keep
unrelated tables outside `public` in this dedicated database. The integration
suite and fingerprint are verified against PostgreSQL 17.5, matching the Nomad
deployment image.

The importer runs all inserts and verification in one transaction, preserving
source posting fingerprints verbatim. It rolls back on catalog, count,
primary-key, row-hash, sequence, or relationship validation failure. A
nonblocking advisory lock rejects concurrent importer executions immediately.
An exactly matching prior import is reported as `already-imported`; a partially
occupied or divergent target is rejected.

D1 timestamps must already use the registry's exact millisecond UTC ISO format.
JSON with duplicate object keys, unsafe integers, or numbers that JavaScript
cannot round-trip exactly is rejected before PostgreSQL is contacted.

Every result reports `sourceDiagnostics`. `fx_rates` and
`pdf_generation_outbox` are intentionally not imported, so their discarded row
counts are reported under `retiredTableRows`. Historical listing-check runs
still marked `running` are preserved verbatim and their count is reported under
`runningListingCheckRuns`; review and acknowledge that count in the cutover
record rather than silently rewriting history.

Use `--validate-only` to validate the D1 export without connecting to
PostgreSQL. Run it against the checksummed export before the write invocation,
retain the command output with the cutover record, and securely remove the
export after rollback is no longer required.

#!/bin/sh

set -eu

readonly migrations_root="${MIGRATIONS_ROOT:-/app/migrations}"
readonly migrations_table="application_registry_schema_migrations"
readonly baseline_directory="20260721150524_registry_baseline"
readonly baseline_id="20260721150524"

export PGDATABASE="${POSTGRES_DATABASE:?POSTGRES_DATABASE is required}"
export PGHOST="${POSTGRES_HOST:?POSTGRES_HOST is required}"
export PGPASSWORD="${POSTGRES_PASSWORD:?POSTGRES_PASSWORD is required}"
export PGPORT="${POSTGRES_PORT:-5432}"
export PGUSER="${POSTGRES_USER:?POSTGRES_USER is required}"

psql_registry() {
  psql --no-psqlrc --set=ON_ERROR_STOP=1 "$@"
}

connection_attempt=1
while ! psql_registry --tuples-only --no-align --command='select 1' >/dev/null 2>&1; do
  if [ "$connection_attempt" -ge 30 ]; then
    echo "PostgreSQL did not become available for registry migrations." >&2
    exit 1
  fi
  connection_attempt=$((connection_attempt + 1))
  sleep 2
done

psql_registry --command="
  create table if not exists ${migrations_table} (
    migration_id text primary key,
    migration_name text not null,
    checksum text not null check (checksum ~ '^[0-9a-f]{64}$'),
    applied_at timestamp with time zone not null default now()
  )
"

baseline_path="${migrations_root}/${baseline_directory}/migration.sql"
if [ ! -f "$baseline_path" ]; then
  echo "The registry baseline migration is missing at ${baseline_path}." >&2
  exit 1
fi

recorded_count="$(
  psql_registry \
    --tuples-only \
    --no-align \
    --command="select count(*) from ${migrations_table}"
)"

if [ "$recorded_count" -eq 0 ]; then
  baseline_table_count="$(
    psql_registry \
      --tuples-only \
      --no-align \
      --command="
        select count(*)
        from unnest(array[
          'application_activities',
          'application_compensations',
          'application_labels',
          'application_listing_check_schedules',
          'application_listing_checks',
          'application_notes',
          'applications',
          'content_entries',
          'content_revisions',
          'cv_links',
          'generated_artifacts',
          'idempotency_receipts',
          'job_posting_snapshots',
          'listing_check_runs',
          'registry_sequence'
        ]) as expected(table_name)
        where to_regclass('public.' || quote_ident(expected.table_name)) is not null
      "
  )"

  if [ "$baseline_table_count" -eq 15 ]; then
    baseline_checksum="$(sha256sum "$baseline_path" | cut -d ' ' -f 1)"
    printf '%s\n' "
        insert into ${migrations_table} (
          migration_id,
          migration_name,
          checksum
        ) values (
          :'migration_id',
          :'migration_name',
          :'migration_checksum'
        )
      " | psql_registry \
      --set=migration_id="$baseline_id" \
      --set=migration_name="registry_baseline" \
      --set=migration_checksum="$baseline_checksum"
    echo "Adopted the existing registry baseline into the migration journal."
  elif [ "$baseline_table_count" -ne 0 ]; then
    echo "Refusing to adopt a partial registry baseline (${baseline_table_count}/15 tables found)." >&2
    exit 1
  fi
fi

migration_found=false
for migration_path in "${migrations_root}"/*/migration.sql; do
  if [ ! -f "$migration_path" ]; then
    continue
  fi

  migration_found=true
  migration_directory="$(basename "$(dirname "$migration_path")")"
  migration_id="${migration_directory%%_*}"
  migration_name="${migration_directory#*_}"
  migration_checksum="$(sha256sum "$migration_path" | cut -d ' ' -f 1)"
  if ! stored_checksum="$(
    printf '%s\n' "
      select checksum
      from ${migrations_table}
      where migration_id = :'migration_id'
    " | psql_registry \
      --tuples-only \
      --no-align \
      --set=migration_id="$migration_id"
  )"; then
    echo "Could not read the migration journal for ${migration_id}." >&2
    exit 1
  fi

  if [ -n "$stored_checksum" ]; then
    if [ "$stored_checksum" != "$migration_checksum" ]; then
      echo "Migration ${migration_id} was changed after it was applied." >&2
      exit 1
    fi
    continue
  fi

  {
    printf 'begin;\n'
    sed 's/--> statement-breakpoint//g' "$migration_path"
    printf '\n'
    printf '%s\n' "
      insert into ${migrations_table} (
        migration_id,
        migration_name,
        checksum
      ) values (
        :'migration_id',
        :'migration_name',
        :'migration_checksum'
      );
    "
    printf 'commit;\n'
  } | psql_registry \
    --set=migration_id="$migration_id" \
    --set=migration_name="$migration_name" \
    --set=migration_checksum="$migration_checksum"

  echo "Applied registry migration ${migration_directory}."
done

if [ "$migration_found" = false ]; then
  echo "No registry migrations were found in ${migrations_root}." >&2
  exit 1
fi

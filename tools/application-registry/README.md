# Application registry

Effect-based operator client and CLI for the application registry Worker. D1
remains behind the Worker API. HTTP transport comes from
`@cv/application-registry-api-client`, which derives it directly from the
`@cv/application-registry-api-contract` declaration; this tool maintains no separate
paths or response codecs.

## Configuration

- `REGISTRY_API_URL`: deployed Worker base URL.
- `REGISTRY_API_TOKEN`: Worker bearer token.
- `REGISTRY_DEVICE_ID`: optional device label written to events.
- `REGISTRY_OUTBOX_DIR`: optional durable outbox path. It defaults to
  `.cv-work/application-registry/outbox` in this repository.

The URL and token are an all-or-nothing pair. Programmatic integrations can use
`readOptionalApplicationRegistryClientConfig` to disable registry integration
when both are absent while still rejecting partial configuration.

Every device uses the same Worker URL and bearer token and therefore sees the
same D1-backed registry. `REGISTRY_DEVICE_ID` is metadata, not an identity or a
database key. Clients do not need Cloudflare/D1 credentials.

## CLI

The CLI is the canonical operator interface for both people and Codex. Callers
must not construct registry HTTP requests or bearer-token headers themselves.
The CLI owns the generated Effect client, API schemas, configuration, errors,
and durable outbox.

```text
application-registry application list|search|get|create|upsert|update|delete|deduplicate|facets
application-registry annotation list
application-registry label list|set|add|remove
application-registry notes add
application-registry event list|append
application-registry capture list|create
application-registry compensation list
application-registry listing scan|history|run
application-registry outbox list|sync
application-registry health
```

Create, upsert, update, event append, note add, capture create, and label set
accept contract-shaped JSON through `--input <path>`. `--input -` reads standard
input and is the preferred machine interface. Mutation input is decoded with
the same Effect Schema used by the Worker API. Commands with `--json` keep
stdout machine-readable; errors and diagnostics remain separate.

Application listing maps operator-friendly flags onto the shared filtering DSL,
and `--all` follows every continuation cursor. `--follow-up-state` remains a CLI
shortcut: `none`, `overdue`, and `upcoming` become primitive `followUpAt`
filters. The CLI captures that filter's reference time once and reuses it for
the complete cursor traversal. `application search` uses the API's cross-field
`q` filter over job key, source, source job ID, canonical URL, company, role,
and location. Create is create-only and conflicts on an existing job key;
upsert is the explicit replacement operation. Delete requires `--yes` and
optionally accepts `--expected-version`.

`application deduplicate` groups records by normalized canonical URL and asks
which record to keep for every conflict. Non-interactive runs can use
`--strategy keep-newest`, `keep-oldest`, or `keep-both`; `--dry-run` prints the
plan, and destructive execution requires `--yes`. Deletions use each record's
current version so a concurrent edit fails safely.

Examples:

```bash
bunx nx run application-registry:registry -- application list --status applied --all --json
bunx nx run application-registry:registry -- application search 'Effect Engineer' --json
bunx nx run application-registry:registry -- application get <id-or-job-key> --json
bunx nx run application-registry:registry -- application create --input application.json --json
bunx nx run application-registry:registry -- application update <id-or-job-key> --input patch.json --json
bunx nx run application-registry:registry -- application deduplicate --dry-run --strategy keep-newest --json
bunx nx run application-registry:registry -- event append <id-or-job-key> --input event.json --json
bunx nx run application-registry:registry -- listing scan --concurrency 96 --per-host 8
bunx nx run application-registry:registry -- outbox sync --json
```

`listing scan` first materializes every registry application, then fetches and
classifies the listings on the local machine. The default pool is 64 requests
with at most six checks active against one hostname. Results are submitted in
durable batches of 50; `--dry-run` skips submission. The backend never fetches
a page on behalf of this command. It validates the target and applies the
durable grace-window and archival policy to the submitted observations.

The default is report-only. `--archive` permits the backend to archive only
`not_started` or `preparing` applications after its confirmation policy passes.
Applications that have already been submitted remain in their lifecycle state
for manual review.

Writes are placed in the typed local outbox before they are sent. Entries are
retained for audit with `synced`, `retry`, `blocked`, or `dead-letter` state.
`outbox sync` only replays pending/retry entries. Authentication failures are
blocked; invalid payloads, conflicts, and response-contract failures are
dead-lettered; transport, throttling, and transient server failures use bounded
Effect retry before remaining queued.

Lifecycle changes, listing-finding batches, and first-class notes enter the
durable typed outbox before the network request. `notes add` writes a `general`
annotation through the receipt-backed notes endpoint with
`application-registry-cli` as its source; replaying the same operation cannot
duplicate the note.

`compensation list` reads the structured original-currency ranges. Passing
`--currency` asks the Worker to return converted minor-unit amounts alongside
the originals, including the exchange rate provider and observation time. The
CLI formats minor units as normal currency amounts; `--json` preserves the
complete generated HTTP response item shape.

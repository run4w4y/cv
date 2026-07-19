# Application registry CLI

Operator client for the single application-registry Worker. It uses the
generated Effect client from the shared unversioned API contract and does not
maintain handwritten routes or codecs.

Configuration:

- `REGISTRY_API_URL`: Worker base URL;
- `REGISTRY_API_TOKEN`: bearer token;
- `REGISTRY_OUTBOX_DIR`: optional durable mutation outbox directory.

The URL and token are an all-or-nothing pair. D1 and Cloudflare credentials are
never required by this client.

Available command groups:

```text
application-registry application list|search|get|create|update|facets
application-registry annotation list
application-registry label list|set|add|remove
application-registry notes add
application-registry activity list
application-registry compensation list
application-registry listing scan|history|run
application-registry outbox list|sync
application-registry health
```

Application creation uses `POST /api/registry/applications`; preparation and
manual callers use the same operation. Applications are addressed by UUID and
their input uses `postingUrl`, company, role, and planning/lifecycle fields.
There is no upsert, delete, deduplication, job-key lookup, or client activity
append compatibility command.

List/search flags compile to the shared `drizzle-query` contract. `--all`
follows cursor pages, while follow-up shortcuts compile to ordinary timestamp
filters using one stable reference time for the traversal.

Mutations accept schema-checked JSON through `--input <path>` (`-` for stdin)
and send idempotency through the HTTP header. Retryable writes use the typed
local outbox; replay cannot duplicate aggregate updates or notes. Activity
commands are read-only because history is issued by backend workflows.

Examples:

```bash
bunx nx run application-registry:registry -- application list --status applied --all --json
bunx nx run application-registry:registry -- application search 'Effect Engineer' --json
bunx nx run application-registry:registry -- application get <uuid> --json
bunx nx run application-registry:registry -- application create --input application.json --json
bunx nx run application-registry:registry -- application update <uuid> --input update.json --json
bunx nx run application-registry:registry -- activity list --application-id <uuid> --json
bunx nx run application-registry:registry -- listing scan --concurrency 96 --per-host 8
bunx nx run application-registry:registry -- outbox sync --json
```

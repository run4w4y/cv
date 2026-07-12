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

```text
application-registry list [--company ...] [--status ...] [--target-stage ...] [--label ...] [--url ...] [--json]
application-registry find <company> [--status ...] [--target-stage ...] [--label ...] [--json]
application-registry show <id-or-job-key> [--json]
application-registry events <id-or-job-key> [--json]
application-registry captures <id-or-job-key> [--json]
application-registry compensations <id-or-job-key> [--currency USD] [--json]
application-registry status <id-or-job-key> <status> [--expected-version ...]
application-registry note <id-or-job-key> <note> [--json]
application-registry sync [--json]
```

Run the CLI through Nx, passing the command after `--`:

```bash
bunx nx run application-registry:registry -- list
bunx nx run application-registry:registry -- find Acme --status applied
bunx nx run application-registry:registry -- captures <id-or-job-key> --json
bunx nx run application-registry:registry -- compensations <id-or-job-key> --currency USD
bunx nx run application-registry:registry -- status <id-or-job-key> interview_loop
bunx nx run application-registry:registry -- sync
```

Writes are placed in the typed local outbox before they are sent. Entries are
retained for audit with `synced`, `retry`, `blocked`, or `dead-letter` state.
`sync` only replays pending/retry entries. Authentication failures are blocked;
invalid payloads, conflicts, and response-contract failures are dead-lettered;
transport, throttling, and transient server failures use bounded Effect retry
before remaining queued.

Lifecycle changes and first-class notes both enter the durable typed outbox
before the network request. `note` writes a `general` annotation through the
receipt-backed notes endpoint with `application-registry-cli` as its source;
replaying the same operation cannot duplicate the note.

`compensations` reads the structured original-currency ranges. Passing
`--currency` asks the Worker to return converted minor-unit amounts alongside
the originals, including the exchange rate provider and observation time. The
CLI formats minor units as normal currency amounts; `--json` preserves the
complete generated HTTP response item shape.

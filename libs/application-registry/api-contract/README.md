# Application registry HTTP contract

This package is the sole HTTP contract for the application registry. It defines
one unversioned Effect `HttpApi`, generates its OpenAPI document, and supplies
the schemas used by the Bun API, browser management app, and CLI client. There
is no parallel legacy API.

The public liveness endpoint is `GET /health`. Registry resources, including
the authenticated health check at `GET /api/registry/health`, live under
`/api/registry` and require bearer authentication. Browsers, desktop clients,
automation, and the MCP server all use those same canonical paths.

The contract is grouped internally by responsibility while remaining one API:

- `applications`: create, get, list, aggregate update, annotations,
  compensations, listing decisions, analytics, and read-only activities;
- `content`: raw blobs, posting snapshots, content entries, and revisions;
- `publications`: CV links and PDF runs/artifacts;
- `automation`: listing-check runs and findings.

Applications are addressed only by their registry UUID. `postingUrl` is the
external posting reference and private normalized/fingerprint columns enforce
deduplication; transport schemas do not expose a second job/source identity.
`POST /api/registry/applications` is used by manual creation and preparation
imports alike.

Activities are backend-issued annotations. Clients can read
`/api/registry/activities` or `/api/registry/applications/:id/activities`, but
the contract intentionally has no activity-write endpoint.

Application and activity list requests are derived from the definitions in
`@cv/application-registry-entity/query`. Their `filters` and `orderBy` query
parameters are the JSON forms defined by `@cv/drizzle-query`; cursor pagination
uses `after` and `size`. Consumers should use the exported encode/decode helpers
instead of inventing an alternate query syntax.

Opaque content uses binary HTTP bodies. `PUT /api/registry/blobs/:sha256`
uploads bytes and `GET` returns bytes. Snapshot and revision JSON bodies contain
only `{ sha256, mediaType }` references, avoiding base64 expansion and keeping
content metadata separate from transport.

The typed `factsPublication` group accepts a strict binary release bundle under
`/api/registry/facts`, registers immutable objects, and activates with an
expected-current compare-and-set. It uses a dedicated publication bearer
credential. Browser reads use the authenticated read-only object route, and the
registry contract carries a facts release ID as content-revision provenance.

Mutations that can be retried take `idempotency-key` in the HTTP header. The
payload contains domain data and optimistic `expectedVersion` values; it does
not duplicate transport idempotency metadata.

# Application registry HTTP contract

This package is the sole HTTP contract for the application registry. It defines
one unversioned Effect `HttpApi`, generates its OpenAPI document, and supplies
the schemas used by the Worker, browser management app, and CLI client. There
is no parallel legacy API.

The public health endpoint is `GET /health`. Registry resources live under
`/api/registry` and require bearer authentication. Browser callers reach those
paths through the same-origin BFF. Direct clients use the Worker's
`/machine/api/registry` transport, which validates the explicitly supplied
bearer credential and strips `/machine` before invoking this contract. Missing
machine credentials are never replaced with the Worker's configured token.

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

Facts releases are not registry HTTP resources. Consumers read the private
static R2 publication directly; the registry contract carries an optional
facts release ID only as content-revision provenance.

Mutations that can be retried take `idempotency-key` in the HTTP header. The
payload contains domain data and optimistic `expectedVersion` values; it does
not duplicate transport idempotency metadata.

# Application registry HTTP contract

The Effect HttpApi and OpenAPI document for the application registry. Database
entity response schemas are reused from `@cv/application-registry-entity`.

Public request/query schemas live here because they describe the transport,
not persistence ports. The Worker and generated
`@cv/application-registry-api-client` compile against the same declaration; there
is no separately maintained REST client.

The append-event request is a schema-level union rather than a convention in a
handler. Lifecycle event kinds require `nextApplicationStatus`; informational
event kinds omit it. This keeps the OpenAPI document, generated client, Worker,
and service boundary aligned and prevents status from being inferred from an
event name.

The same public contract is a first-class Grafana target. Application pages
return camelCase dashboard-ready rows, `/v1/applications/facets` supplies
observed filter values, and the global event feed supports source-time and kind
filters while retaining its revision cursor. Query schemas accept either one
value or repeated values for multi-select fields; no Grafana-specific DTO or
route family is maintained in parallel.

Both global list queries accept numeric limits from 1 through 100, defaulting
to 50 in the service. Responses retain the synchronization checkpoint and use
`nextCursor` for page traversal.

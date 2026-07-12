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

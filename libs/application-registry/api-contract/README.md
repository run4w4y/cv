# Application registry HTTP contract

The Effect HttpApi and OpenAPI document for the application registry. Database
entity response schemas are reused from `@cv/application-registry-entity`.

Public request schemas live here because they describe the transport, not
persistence ports. The Worker and generated
`@cv/application-registry-api-client` compile against the same declaration; there
is no separately maintained REST client.

Application and event list capabilities are defined once by the entity package
under `@cv/application-registry-entity/query`. Each table-first definition
declares its filterable and sortable columns, computed fields, relations,
custom operators, default ordering, and cursor pagination. This contract
package derives the HTTP Effect Schemas from those definitions, while CRUD
compiles the same objects directly. Adding a field or operator therefore does
not require a second transport DTO.

The append-event request is a schema-level union rather than a convention in a
handler. Lifecycle event kinds require `nextApplicationStatus`; informational
event kinds omit it. This keeps the OpenAPI document, generated client, Worker,
and service boundary aligned and prevents status from being inferred from an
event name.

The generic GET wire format uses `filters=<JSON array>` and
`orderBy=<JSON array>`. Cursor pagination remains readable as flat `after` and
`size` parameters; the decoded TypeScript request contains them under
`pagination`. The application-only `currency` parameter remains flat.
`@cv/drizzle-query-effect/schema` provides the same bidirectional codec and
`URLSearchParams` helpers to servers, generated clients, CLIs, and other
TypeScript consumers. Numeric sizes are limited to 1–100 and default to 50.
Responses are ordinary `{ items, pageInfo }` query pages;
`pageInfo.nextCursor` is supplied as the next request's `after` parameter.

Revision-based reads use the same filters and ordering as every other query.
For example, an application consumer can request rows after a known revision
with an `updatedRevision gt <revision>` condition and order by
`updatedRevision asc`. Event consumers can do the same with `revision`. These
fields remain ordinary filterable and sortable data rather than defining a
second synchronization or continuation protocol.

Follow-up categories are also expressed through the stored `followUpAt` field.
`isNull` selects applications without a follow-up, `lt <reference-time>`
selects overdue applications, and `gte <reference-time>` selects upcoming
applications. The caller owns that reference time. A client following
`nextCursor` across several pages must reuse the same timestamp in every
request so the filter, and therefore the cursor-bound query, stays unchanged
for the complete traversal.

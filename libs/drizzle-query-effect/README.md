# `@cv/drizzle-query-effect`

Effect integration for `@cv/drizzle-query`. The root entry point provides typed
Effect wrappers around query resolution and finalization. The `./schema`
entry point provides reusable Effect Schemas, definition-derived request and
HTTP query codecs, and browser-native query-string helpers.

```ts
import { resolveQuery, finalizeQuery } from '@cv/drizzle-query-effect'
import { Effect, Schema } from 'effect'
import {
  fromSearchParams,
  queryParamsSchema,
  queryRequestSchema,
  schemaCursorState,
  toSearchParams,
} from '@cv/drizzle-query-effect/schema'

const RequestSchema = queryRequestSchema(applicationsQuery)

const QueryParamsSchema = queryParamsSchema(applicationsQuery, {
  extras: {
    tenantId: Schema.optional(Schema.String),
  },
})

const params = yield* toSearchParams(QueryParamsSchema, {
  filters: [
    {
      type: 'condition',
      field: 'status',
      operator: 'in',
      value: ['active'],
    },
  ],
  pagination: { after: nextCursor, size: 25 },
  tenantId,
})

const request = yield* fromSearchParams(QueryParamsSchema, params)

// A browser or CLI consumer chooses its own synchronous boundary when needed.
const browserParams = Effect.runSync(toSearchParams(QueryParamsSchema, request))
const browserRequest = Effect.runSync(
  fromSearchParams(QueryParamsSchema, browserParams)
)

const CursorStateSchema = Schema.Struct({ asOf: Schema.String })
const cursorState = schemaCursorState(CursorStateSchema)
```

`queryRequestSchema` derives filter fields, unary and binary operators, operand
types, ordering fields, and the selected built-in pagination request directly
from a query definition. No second list of query capabilities is required.

`queryParamsSchema` represents `filters` and `orderBy` as one JSON query
parameter each. Cursor pagination uses flat `after` and `size` parameters;
page pagination uses flat `page` and `size` parameters. Its decoded value keeps
pagination nested exactly like the core `QueryRequest`. Consumer-specific
parameters can be added through `extras` without redefining the generic fields.

`schemaCursorState` adapts one existing Effect Schema to the core package's
synchronous cursor-state codec. Use it in `defineQuery` when request-owned state
must be embedded in and recovered from every continuation token; no duplicate
state validator is required.

Custom binary operators can provide their operand schema at their sole
definition site:

```ts
import { schemaBinaryFilterOperator } from '@cv/drizzle-query-effect/schema'
import { Schema } from 'effect'
import { sql } from 'drizzle-orm'

const within = schemaBinaryFilterOperator(
  'within',
  Schema.Struct({ minimum: Schema.Number, maximum: Schema.Number }),
  {
    compile: ({ expression, value }) =>
      sql`${expression} between ${value.minimum} and ${value.maximum}`,
  },
)
```

The Effect package stores this schema under its own symbol in the operator's
opaque core annotation map. Core does not know what the annotation contains
and therefore remains independent of Effect. Other integrations can retain
their own symbol-keyed annotations on the same operator. Default operators use
the scalar and collection descriptors already retained by the core definition.

`resolveQuery` and `finalizeQuery` translate only
`@cv/drizzle-query`'s package-owned `QueryError` into the typed Effect error
channel; unexpected exceptions remain defects. Required operator compile
context is preserved by the wrapper's call signature. `finalizeQuery` accepts
any structural object with a compatible `finalize(rows, totalItems?)` method,
so the ordinary select view and relational-query views use the same wrapper
without coupling this package to either concrete class.

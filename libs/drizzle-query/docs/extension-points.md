# Extension points and package boundaries

`@cv/drizzle-query` provides a default pipeline while keeping application- and
dialect-specific choices explicit. Its extension points are synchronous and
Effect-free: they accept typed values and produce ordinary Drizzle SQL or page
metadata.

## Custom filtering semantics

Use `binaryFilterOperator` for a condition with one right-hand-side request
value and `unaryFilterOperator` for a condition with no value:

```ts
const minimumLength = binaryFilterOperator<"minimumLength", number>(
  "minimumLength",
  {
    compile: ({ expression, value }) =>
      sql`length(${expression}) >= ${sql.param(value)}`,
  },
);

const isPresent = unaryFilterOperator("isPresent", {
  compile: ({ expression }) => sql`${expression} is not null`,
});

col.name.filterable((defaults) =>
  appendOperators(defaults, [minimumLength, isPresent]),
);
```

Operator resolution is not a parsing hook. The value supplied to a binary
operator already has its declared TypeScript type. Consumers decode and
validate untrusted requests before `definition.resolve`, using Effect Schema,
Zod, or any other boundary library.

The operator array is the complete capability declaration. Array helpers keep
customization explicit:

```ts
const customEquality = binaryFilterOperator<"eq", string>("eq", {
  compile: ({ expression, value, bind }) =>
    sql`lower(${expression}) = lower(${bind(value)})`,
});

const customJsonOperator = binaryFilterOperator<"hasKind", string>("hasKind", {
  compile: ({ expression, value }) => sql`json_extract(${expression}, '$.kind') = ${sql.param(value)}`,
});

col.name.filterable((defaults) =>
  appendOperators(
    replaceOperator(
      withoutOperators(defaults, ["notContains"]),
      customEquality,
    ),
    [minimumLength],
  ),
);

col.code.filterable((defaults) => pickOperators(defaults, ["eq", "in"]));
col.payload.filterable([customJsonOperator]);
```

- `pickOperators` keeps only selected defaults;
- `withoutOperators` disables selected defaults;
- `replaceOperator` overloads an existing name with custom SQL;
- `appendOperators` adds new names.

Built-in operators put values in Drizzle parameters, including text patterns
and list members. Custom implementations should interpolate request values
through the supplied `bind` function or `sql.param`, not `sql.raw`. The
consumer owns any custom SQL it supplies.

Binary operators default to the field's operand shape. Set
`valueShape: 'array'` or `valueShape: 'tuple'` when a custom operator accepts a
list or pair of field values. This metadata lets schema integrations derive the
operand without relying on conventional operator names. A completely different
operand shape can instead provide an adapter-owned schema annotation.

## Custom pagination

`PaginationImplementation<Request, Info, Kind>` supports strategies beyond
the page and forward-cursor built-ins:

```ts
const batchPagination = {
  kind: "batch",
  usesCursor: false,
  compile(request) {
    const size = request?.size ?? 100;

    return {
      kind: "batch",
      size,
      limit: size + 1,
      offset: undefined,
      finish: (rows) => ({
        items: rows.slice(0, size),
        pageInfo: {
          kind: "batch",
          size,
          hasNextPage: rows.length > size,
        },
      }),
    };
  },
} satisfies PaginationImplementation<
  { size?: number },
  { kind: "batch"; size: number; hasNextPage: boolean },
  "batch"
>;
```

The request is typed by the implementation, including when it is declared with
`satisfies` or directly inline in `defineQuery`, and the returned resolution
is trusted to satisfy its contract. The strategy resolves target-neutral
state: logical size, execution limit, optional offset or decoded cursor values,
and the finalizer. It does not produce Drizzle SQL. The select and relational
renderers lower that state after binding their concrete table or RQB alias.
Validate transport input before resolution; enforce strategy-specific numeric
or business constraints in the strategy where they are part of its actual
semantics.

Set `usesCursor: true` only when the implementation consumes the cursor
runtime in its compile context. The query definition supplies decoding, while
each target renderer supplies seek SQL, private ordering-value projection, and
row encoding for the resolved effective ordering.

## Custom cursor representation

`CursorCodec` controls the token's outer synchronous representation. Its
`encode` method receives a structured cursor payload and returns a string;
`decode` returns the decoded payload. This is the extension point for signing
or encryption.

Scalar serialization, bounded payload decoding, query identity matching, and
seek semantics remain package-owned. The resolved effective ordering is part
of that query identity; there is no parallel order signature or public
scalar-codec registry.

Use `cursor.revision` to invalidate existing tokens when custom SQL, operator,
pagination, or codec semantics change without a corresponding visible
definition change:

```ts
defineQuery(table, defineFields, {
  pagination: cursorPagination(),
  cursor: {
    codec: signedCursorCodec,
    revision: 4,
  },
});
```

## Consumer-owned query construction

The common path applies the complete clause set:

```ts
const rows = await resolved.select
  .apply(baseSelect.$dynamic(), { where: tenantPredicate })
  .all();
```

The specialized path consumes only the pieces it needs:

```ts
const select = resolved.select;
const filteringWhere = select.filtering.where;
const orderBy = select.ordering.orderBy;
const hiddenSelection = select.ordering.requiredSelection;
const seekWhere = select.pagination.seekWhere;
const limit = select.pagination.limit;
const offset = select.pagination.offset;
const completeWhere = select.where;
```

This is intended for CTEs, aggregation, dialect-specific joins, and builders
where clause placement must remain consumer-owned. `select.where` already
combines filtering and cursor seek predicates; do not apply it together with
those same individual predicates.

Drizzle's dynamic `where` and `orderBy` calls replace rather than merge prior
calls, so let `select.apply` own those clauses on the common path. Cursor
projections must include `select.requiredSelection`, and executed rows must
pass through `select.finalize`.

The relational-query equivalent is intentionally config-shaped:

```ts
const relational = resolved.relational({
  select: ["computedScore"] as const,
});

const rows = await db.query.records.findMany({
  ...relational.config,
  columns: { id: true, name: true },
  with: { owner: true },
});

const page = relational.finalize(rows);
```

The package owns only the fields in `relational.config`. The consumer owns the
`findMany` call, `columns`, `with`, and domain result mapping. Computed
expression extras are opt-in through `select`; private cursor extras are added
at runtime as needed, kept out of public row inference, and removed by
`relational.finalize`.

## Effect and execution runtimes

The package has no `effect` dependency and needs no Effect-specific entry
point. `SelectQueryView.apply` is structural and returns the exact dynamic
builder type it receives, so an Effect-enabled Drizzle builder remains
Effect-enabled.

Resolution is synchronous and can throw `QueryError` for definition,
ordering, pagination, or cursor semantics. A consumer can resolve before
constructing an Effect or capture that exception at its service boundary.

## Supported public surface

The package root exports:

- `defineQuery`, `QueryDefinition`, `ResolvedQuery`, and the select and
  relational view types;
- page/cursor pagination factories, target-neutral resolution, and public
  pagination contracts;
- field, filter, ordering, request, page, and error types;
- unary/binary operator factories, default operator factories, and array
  helpers;
- the outer `CursorCodec` contract and default codec.

Raw filter/order/query compilers, field runtimes and registries, SQL-combining
helpers, cursor identity/hash functions, payload validation, seek construction,
and token internals are not root exports. Treat source-module paths as private.

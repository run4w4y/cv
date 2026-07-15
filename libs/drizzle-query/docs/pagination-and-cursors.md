# Pagination and cursors

Every query definition chooses one pagination implementation. The request
envelope remains `{ filters?, orderBy?, pagination? }`; the selected
implementation determines the inferred `pagination` shape, with no separate
mode property.

Both built-ins resolve to target-neutral pagination state: `size`, a
look-ahead `limit`, an optional `offset`, optional decoded cursor values, and a
result finalizer. The select and relational renderers lower that same state to
their respective Drizzle APIs. Both fetch `size + 1` rows; the chosen view's
`finalize` returns at most `size` items and uses the extra row to determine
`hasNextPage`.

## Page/size pagination

Page numbers are one-based:

```ts
const definition = defineQuery(
  applications,
  ({ col }) => [
    col.id.sortable({ unique: true }),
    col.name.filterable().sortable(),
  ],
  {
    pagination: pagePagination({
      defaultSize: 25,
      maxSize: 100,
      overflow: "reject",
    }),
    defaultOrderBy: [{ field: "name" }, { field: "id" }],
  },
);

const resolved = definition.resolve({
  pagination: { page: 3, size: 20 },
});

const select = resolved.select;
const rows = await select.apply(baseSelect.$dynamic()).all();
const page = select.finalize(rows, optionalTotalItems);
```

`pageInfo` contains `kind`, `page`, `size`, `hasNextPage`, and
`hasPreviousPage`. Supplying a non-negative total to `finalize` also adds
`totalItems` and `pageCount`. Counting stays consumer-owned because arbitrary
joins, CTEs, grouping, and projections have no universally correct count.

`overflow: 'reject'` rejects a size above `maxSize`; `'clamp'` caps it at the
maximum. The built-in also enforces positive safe integers and a safe SQL
offset. These are pagination semantics, not general transport decoding:
consumers still validate unknown request objects before calling `resolve`.

Offset pagination needs deterministic ordering too. If the effective order
does not include a complete unique tuple, resolution appends an enabled
single-field or composite tie-breaker where possible.

## Cursor pagination

Cursor requests use `{ after?, size? }`:

```ts
const feed = defineQuery(
  applications,
  ({ col }) => [
    col.tenantId.sortable(),
    col.id.sortable(),
    col.status.filterable(),
    col.updatedAt.sortable(),
  ],
  {
    pagination: cursorPagination({ defaultSize: 50, maxSize: 100 }),
    defaultOrderBy: [
      {
        field: "updatedAt",
        direction: "desc",
        nulls: "last",
      },
      { field: "tenantId" },
      { field: "id" },
    ],
    uniqueBy: [["tenantId", "id"]],
    cursor: { revision: 2 },
  },
);

const resolved = feed.resolve({
  filters: [
    {
      type: "condition",
      field: "status",
      operator: "eq",
      value: "active",
    },
  ],
  pagination: {
    size: 50,
    ...(request.after === undefined ? {} : { after: request.after }),
  },
});

const select = resolved.select;
const rows = await select
  .apply(
    db
      .select({
        id: applications.id,
        status: applications.status,
        updatedAt: applications.updatedAt,
        ...select.requiredSelection,
      })
      .from(applications)
      .$dynamic(),
  )
  .all();

const page = select.finalize(rows);
// page.pageInfo.nextCursor
```

Ordering is lexicographic with explicit, dialect-neutral null placement. A
cursor order must end in a non-null unique field or include a declared
composite unique tuple. If a requested order omits an available tie-breaker,
the resolver appends it. Changing an enum's declared rank changes cursor
compatibility.

For an ordinary select, cursor generation needs every effective ordering
value. Spread `select.requiredSelection` into the Drizzle selection before
execution. It carries those values below a reserved nested key, which
`select.finalize` removes from returned items. Page pagination exposes an empty
required selection.

For a relational query, use the relational view instead:

```ts
const relational = feed.resolve(request).relational();

const rows = await db.query.applications.findMany({
  ...relational.config,
  columns: { id: true, status: true, updatedAt: true },
  with: {
    tags: { columns: { id: true, name: true } },
  },
});

const page = relational.finalize(rows);
```

The package adds private cursor extras to `relational.config` for effective
ordering values, except where an explicitly selected expression can be reused
safely. Those extras stay out of the inferred public row type and are removed
by `relational.finalize`. The consumer continues to own `findMany`, `columns`,
`with`, and the API result shape.

## Cursor identity and representation

A cursor is bound to:

- the query definition and manual cursor revision;
- the resolved filter tree and values;
- the effective order, directions, null placement, and value types;
- optional consumer-owned binding data.

The package derives opaque, stable hashes for those identities. The hash
representation is an implementation detail; callers should persist and return
only the complete cursor token. A token cannot silently be reused with a
different definition, filter, order, or consumer binding.

Bump `cursor.revision` when custom SQL or operator behavior changes without a
corresponding declared-field change:

```ts
defineQuery(table, defineFields, {
  pagination: cursorPagination(),
  cursor: { revision: 3 },
});
```

The default outer representation is base64url-encoded JSON. It is opaque to
API clients but is neither signed nor encrypted. A synchronous `CursorCodec`
can provide either property:

```ts
defineQuery(table, defineFields, {
  pagination: cursorPagination(),
  cursor: { codec: signedCodec, revision: 3 },
});
```

The codec owns only the outer token representation. The package retains
scalar serialization, bounded payload decoding, query identity matching, and
seek semantics. The query identity includes the resolved effective ordering,
so order compatibility does not require a separate cursor signature.

## Cursor state and known starting values

A cursor definition can carry typed consumer state that must remain fixed for
an entire continuation chain, such as a request-time snapshot instant. Supply
one synchronous `CursorStateCodec` when defining the query, then provide the
initial state only on the first page. Later pages recover it from `after`:

```ts
const feed = defineQuery(table, defineFields, {
  pagination: cursorPagination(),
  cursor: {
    context: (state) => ({ asOf: state.asOf }),
    revision: 4,
    state: cursorStateCodec,
  },
});

const first = feed.resolve(firstRequest, {
  cursor: { initialState: { asOf } },
});

const continued = feed.resolve(requestWithAfter, {});
continued.cursorState; // { asOf }
```

The core package does not prescribe a schema library. Effect consumers can
create the codec from an existing Effect Schema with `schemaCursorState` from
`@cv/drizzle-query-effect/schema`.

Durable checkpoints are domain data, not cursor positions. Express a checkpoint
as an ordinary typed filter and carry that filter alongside the opaque
continuation cursor on later pages:

```ts
const delta = feed.resolve({
  filters: [
    { type: 'condition', field: 'revision', operator: 'gt', value: checkpoint },
  ],
  pagination: request.pagination,
});
```

## Consumer predicates and binding

`select.apply` can combine one consumer-owned predicate with the resolved
predicate:

```ts
const cursorBinding = { tenantId, visibilityRevision: 4 };
const resolved = feed.resolve(request, { cursorBinding });

const rows = await resolved.select
  .apply(baseSelect.$dynamic(), {
    where: eq(applications.tenantId, tenantId),
  })
  .all();
```

The resolver cannot inspect arbitrary SQL supplied to `select.apply`. Every
external constraint that changes cursor results must therefore be represented
in both the SQL predicate and `cursorBinding`. Use stable, data-only binding
values; the same token resolved under different binding data fails with a
cursor mismatch. Page pagination ignores `cursorBinding` because it creates no
token.

## Composing fragments manually

`select.apply` owns `where`, `orderBy`, `limit`, and `offset` on a dynamic
Drizzle builder. When a CTE, grouping operation, or dialect-specific builder
needs different clause placement, use `select.filtering.where`,
`select.ordering.orderBy`, `select.pagination.seekWhere`,
`select.pagination.limit`, and `select.pagination.offset` directly.
`select.where` is the ready-made combination of the filter and seek
predicates.

Keep `select.requiredSelection` and `select.finalize` together in every
ordinary-select cursor path. Relational queries should spread
`relational.config` and use `relational.finalize` instead.

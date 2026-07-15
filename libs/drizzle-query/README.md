# `@cv/drizzle-query`

An Effect-free query-definition layer for Drizzle. It turns a table and a
typed field declaration into reusable filtering, deterministic ordering, and
either page/size or forward-cursor pagination.

The package resolves each request once, then renders it as ordinary Drizzle SQL
fragments or a relational-query configuration. It does not execute the query,
choose joins or projections, or decode HTTP input. Consumers validate transport
data with Effect Schema, Zod, or any other boundary mechanism and then pass a
typed `QueryRequest` to `resolve`. The resulting definition works with ordinary
and Effect-enabled Drizzle builders.

## Installation

This is a private workspace package. Add it to a consumer with:

```json
{
  "dependencies": {
    "@cv/drizzle-query": "workspace:*"
  }
}
```

Drizzle is a peer dependency, so the consumer supplies the repository's
supported `drizzle-orm` version.

Effect consumers can add `@cv/drizzle-query-effect`. Its root entry point wraps
resolution and finalization in typed Effects, while its `./schema` entry point
derives Effect request and HTTP query codecs from the definition metadata,
provides bidirectional `URLSearchParams` conversion, and supplies reusable
pagination/finalized-page schemas. The core package remains Effect-free.

## Mental model

1. `defineQuery(table, defineFields, options)` declares the public fields and
   selects one pagination implementation.
2. `definition.resolve(typedRequest)` resolves filtering, deterministic
   ordering, cursor decoding, and target-neutral pagination state once.
3. Choose `resolved.select` for an ordinary dynamic select or
   `resolved.relational()` for Drizzle's relational query builder.
4. Execute the consumer-owned query and call that view's `finalize(rows)` to
   remove the look-ahead row and private cursor data.

The field callback returns one array. Its second argument is the concrete table
instance behind the field builders, which lets computed expressions follow a
Drizzle alias without duplicating a field declaration. A column is neither
filterable nor sortable until it is marked with `.filterable()` or
`.sortable()`. Ordinary columns retain their table names; computed and
relationship fields receive an API name with `.as(...)`.

## Page/size example

```ts
import { defineQuery, pagePagination } from "@cv/drizzle-query";

const applicationsQuery = defineQuery(
  applications,
  ({ col }) => [
    col.id.filterable().sortable({ unique: true }),
    col.name.filterable().sortable(),
    col.status
      .filterable()
      .sortable({ values: ["draft", "active", "archived"] }),
    col.updatedAt.filterable().sortable(),
  ],
  {
    pagination: pagePagination({ defaultSize: 25, maxSize: 100 }),
    defaultOrderBy: [
      { field: "updatedAt", direction: "desc" },
      { field: "id" },
    ],
  },
);

// Validate and decode the transport request before this point.
const resolved = applicationsQuery.resolve({
  filters: [
    {
      type: "condition",
      field: "status",
      operator: "in",
      value: ["active"],
    },
  ],
  orderBy: [{ field: "updatedAt", direction: "desc" }],
  pagination: { page: 1, size: 25 },
});

const select = resolved.select;
const rows = await select
  .apply(
    db
      .select({ id: applications.id, name: applications.name })
      .from(applications)
      .$dynamic(),
  )
  .all();

return select.finalize(rows, optionalTotalItems);
```

Both built-ins fetch `size + 1` rows to detect another page. A total count is
optional because the package cannot infer the correct count for arbitrary
joins, grouping, or projections.

## Cursor example

```ts
import { cursorPagination, defineQuery } from "@cv/drizzle-query";

const applicationsFeed = defineQuery(
  applications,
  ({ col }) => [
    col.tenantId.sortable(),
    col.id.sortable(),
    col.name.filterable(),
    col.updatedAt.sortable(),
  ],
  {
    pagination: cursorPagination({ defaultSize: 50, maxSize: 100 }),
    defaultOrderBy: [
      { field: "updatedAt", direction: "desc" },
      { field: "tenantId" },
      { field: "id" },
    ],
    uniqueBy: [["tenantId", "id"]],
  },
);

const resolved = applicationsFeed.resolve(
  {
    pagination: {
      size: 50,
      ...(request.after === undefined ? {} : { after: request.after }),
    },
  },
  { cursorBinding: { tenantId } },
);

const select = resolved.select;
const rows = await select
  .apply(
    db
      .select({
        id: applications.id,
        name: applications.name,
        ...select.requiredSelection,
      })
      .from(applications)
      .$dynamic(),
    { where: eq(applications.tenantId, tenantId) },
  )
  .all();

return select.finalize(rows);
```

Cursor ordering must end in a non-null unique field or a declared composite
tuple. `select.requiredSelection` carries the effective ordering values needed
to create the next token; `select.finalize` removes that private metadata from
returned items. When a consumer-owned predicate changes the result set,
represent the same constraint in `cursorBinding` so its cursor tokens cannot
cross that boundary.

## Select and relational views

`resolve` creates shared, target-neutral request state. It does not commit the
request to a particular Drizzle query API. Each view lowers the same resolved
filters, ordering, and pagination state for its target.

The ordinary-select view applies SQL to a `$dynamic()` builder and exposes its
parts for custom clause placement:

```ts
const select = resolved.select;

select.filtering.where;
select.ordering.orderBy;
select.ordering.requiredSelection;
select.pagination.seekWhere;
select.pagination.limit;
select.pagination.offset;
select.where;
```

`select.where` already combines filtering and the cursor seek predicate.
`select.apply` is the low-friction path and owns `where`, `orderBy`, `limit`,
and `offset`. The corresponding properties on `resolved` delegate to this
default select view.

The relational view instead produces the package-owned part of a Drizzle
`findMany` configuration. In this example, `normalizedName` is an
`expr.*(...).as('normalizedName')` field from the definition:

```ts
const relational = resolved.relational({
  select: ["normalizedName"] as const,
});

const rows = await db.query.applications.findMany({
  ...relational.config,
  columns: {
    id: true,
    name: true,
  },
  with: {
    tags: {
      columns: { id: true, name: true },
    },
  },
});

return relational.finalize(rows);
```

The consumer owns `findMany`, `columns`, `with`, and the returned domain shape.
Query-defined computed expressions are not added to relational results by
default; opt into the ones that belong in the response through
`relational({ select: [...] })`. Filtering and ordering may still use an
expression that is not selected.

For cursor pagination, `relational.config.extras` adds private ordering values
at runtime without adding them to Drizzle's inferred public row type.
`relational.finalize` reads and removes those extras. Always spread the config
and finalize the rows from the same relational view; consumers do not need to
construct or attach cursor metadata.

## Composing individual fragments

`select.apply` is the low-friction path and owns `where`, `orderBy`, `limit`,
and `offset`. Specialized query builders can instead place the resolved parts
themselves:

```ts
const select = resolved.select;

select.filtering.where;
select.ordering.orderBy;
select.ordering.requiredSelection;
select.pagination.seekWhere;
select.pagination.limit;
select.pagination.offset;
select.where;
```

`select.where` already combines the filter predicate and cursor seek predicate.
The fragment interface supports consumer-owned CTEs, joins, aggregation, and
custom clause placement without asking this package to own those choices.

The relational renderer handles Drizzle's internal root alias by rebinding the
field declaration lazily. Expressions and custom operator closures that refer
to the root table should therefore use the table passed as the field
callback's second argument.

For stable pagination, the SQL reaching `limit` must have one row per logical
API item. Aggregate a row-multiplying relation first, project it with a
correlated subquery, or define a unique tuple for the actual result rows.

## Guides

- [Fields, inferred filters, and custom operators](./docs/fields-and-filtering.md)
- [Page and cursor pagination](./docs/pagination-and-cursors.md)
- [Computed expressions and relationships](./docs/expressions-and-relations.md)
- [Extension points and package boundaries](./docs/extension-points.md)

The root entry point is the supported public surface. Raw compilers, field
runtimes, SQL helpers, and cursor-token internals remain implementation
details.

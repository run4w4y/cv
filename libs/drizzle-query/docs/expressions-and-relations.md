# Expressions and relationships

The table passed to `defineQuery` supplies the default field model, while an
API result often also contains computed values and related collections. The
field callback exposes `expr` and `rel` for those cases. The consumer still
owns ordinary-select joins and CTEs, or relational `columns`, `with`, and the
`findMany` call, as well as final domain-model mapping.

The field callback is evaluated again when SQL must target a relational-query
alias. Use its second argument for root-table references in expressions and
custom operator closures.

## Computed expressions

Drizzle's `SQL<T>` does not retain enough runtime metadata to infer database
filtering and cursor behavior. Choose the scalar kind and assign an API name:

```ts
const query = defineQuery(
  applications,
  ({ col, expr }, root) => [
    col.id.sortable({ unique: true }),
    expr
      .string(sql<string>`lower(${root.name})`, {
        bind: (value) => sql.param(value.toLowerCase()),
      })
      .as("normalizedName")
      .filterable()
      .sortable(),
    expr
      .number(sql<number>`coalesce(${applicationScores.score}, 0)`)
      .as("score")
      .filterable()
      .sortable(),
  ],
  { pagination: pagePagination() },
);
```

The helpers are `expr.string`, `number`, `bigint`, `boolean`, `date`, `enum`,
and `custom`. Set `nullable: true` when the SQL expression can return `null`.
`bind` maps a logical field value to its database representation for filtering
and cursor comparisons.

`expr.enum` needs the allowed values and, when sortable, an explicit rank:

```ts
expr
  .enum(sql<"urgent" | "normal">`priority`, ["urgent", "normal"])
  .as("priority")
  .filterable()
  .sortable({ values: ["urgent", "normal"] });
```

A custom expression has no default binary operators and cannot be sorted
unless it declares cursor scalar metadata:

```ts
expr
  .custom(sql<string>`special_value`, { cursor: { type: "string" } })
  .as("specialValue")
  .filterable([customOperator])
  .sortable();
```

Expressions may reference columns introduced by consumer-owned joins or CTEs.
Every base builder used with that definition must include those dependencies.
Such an expression is available to the relational view only when its SQL is
also valid inside that relational query; the package does not synthesize an
external join. Root-table expressions written against the callback's second
argument are the portable common case.

## A realistic relationship model

Consider an application list backed by:

- `applications`, with a required `company_id`;
- `companies`, joined one-to-one for the displayed company name;
- `tags` and `application_tags`, a many-to-many classification;
- `orders`, a one-to-many relation summarized as `orderCount`.

The definition can expose filters for the related tags and scalar aggregates
without dictating how the final response is projected:

```ts
const applicationQuery = defineQuery(
  applications,
  ({ col, expr, rel }, root) => {
    const tagRelation = rel.many(tags, {
      value: ({ related }) => related.slug,
      on: ({ root, related }) =>
        sql`exists (
          select 1
          from ${applicationTags}
          where ${applicationTags.applicationId} = ${root.id}
            and ${applicationTags.tagId} = ${related.id}
        )`,
    });

    const orderRelation = rel.many(orders, {
      value: ({ related }) => related.id,
      on: ({ root, related }) => sql`${related.applicationId} = ${root.id}`,
    });

    return [
      col.id.filterable().sortable({ unique: true }),
      col.name.filterable().sortable(),
      expr
        .string(sql<string>`lower(${root.name})`)
        .as("normalizedName")
        .filterable()
        .sortable(),
      expr
        .string(sql<string>`${companies.name}`)
        .as("companyName")
        .filterable()
        .sortable(),
      tagRelation.as("tags").filterable(),
      tagRelation.count().as("tagCount").filterable().sortable(),
      orderRelation.count().as("orderCount").filterable().sortable(),
    ];
  },
  {
    pagination: cursorPagination({ defaultSize: 25 }),
    defaultOrderBy: [{ field: "id" }],
  },
);
```

The default many-valued operators are:

- `hasAny`: at least one requested related value exists;
- `hasAll`: every requested related value exists;
- `hasNone`: no requested related value exists;
- `isEmpty` and `isNotEmpty`: unary existence checks.

`hasAll` deduplicates equal requested values and emits one correlated existence
condition per distinct value. A raw collection has no generic ordering
semantics. `.count()` reduces it to a number with normal numeric filtering and
ordering.

The callback form of `.filterable((defaults, tools) => ...)` exposes the
related value expression plus `exists` and `notExists` builders. Use the same
array helpers as scalar fields to add, remove, or replace relationship
operators.

Returning a Drizzle column from `value` infers both its logical TypeScript type
and its driver encoder. A computed `SQL<T>` value keeps `T`, but must provide an
explicit `bind` function because its database representation cannot be inferred:

```ts
rel.many(tags, {
  value: ({ related }) => sql<string>`lower(${related.slug})`,
  bind: (value) => sql.param(value.toLowerCase()),
  on: ({ root, related }) =>
    sql`exists (
      select 1
      from ${applicationTags}
      where ${applicationTags.applicationId} = ${root.id}
        and ${applicationTags.tagId} = ${related.id}
    )`,
});
```

## Returning one unified API row

Filtering a relation and projecting it are separate. The resolved request can
be rendered either for an ordinary select or for Drizzle's relational query
builder without resolving the request twice.

### Ordinary select

For SQLite, one statement can join the one-to-one company and project
tags with a correlated JSON aggregate without multiplying application rows:

```ts
const projectedTags = sql<string>`(
  select coalesce(
    json_group_array(${tags.slug} order by ${tags.slug}),
    json('[]')
  )
  from ${applicationTags}
  inner join ${tags} on ${tags.id} = ${applicationTags.tagId}
  where ${applicationTags.applicationId} = ${applications.id}
)`.mapWith(String);

const select = applicationQuery.resolve(request).select;
const rows = await select
  .apply(
    db
      .select({
        id: applications.id,
        name: applications.name,
        company: {
          id: companies.id,
          name: companies.name,
        },
        tags: projectedTags,
        ...select.requiredSelection,
      })
      .from(applications)
      .innerJoin(companies, eq(companies.id, applications.companyId))
      .$dynamic(),
  )
  .all();

const page = select.finalize(rows);
return {
  ...page,
  items: page.items.map((item) => ({
    ...item,
    tags: JSON.parse(item.tags) as string[],
  })),
};
```

The select view owns only the package clauses and private cursor selection.
The consumer remains responsible for the projection, joins, aggregate
decoding, and ensuring that the selected query produces one row per API item.

### Relational query builder

When the schema has Drizzle relations, the same request can become the
package-owned part of a `findMany` config:

```ts
const relational = applicationQuery.resolve(request).relational({
  select: ["normalizedName"] as const,
});

const rows = await db.query.applications.findMany({
  ...relational.config,
  columns: {
    id: true,
    name: true,
    status: true,
  },
  with: {
    company: {
      columns: { id: true, name: true },
    },
    applicationTags: {
      columns: {},
      with: {
        tag: {
          columns: { id: true, slug: true },
        },
      },
    },
  },
});

return relational.finalize(rows);
```

`relational.config` contains only package-owned `where`, `orderBy`, `limit`,
`offset`, and `extras`. The consumer owns `findMany`, `columns`, `with`, and
therefore the inferred result shape. Query-defined expressions are opt-in in
the public result through `relational({ select: [...] })`; expressions may be
used for filtering or ordering without being selected.

With cursor pagination, the relational view places any additional ordering
values in private runtime extras. They are deliberately absent from the
inferred row type, and `relational.finalize` consumes and removes them while
producing the page. Spread `relational.config` and finalize with the same view;
no consumer-authored cursor fields are required.

PostgreSQL can use `json_agg`/`jsonb_agg`; MySQL can use its JSON aggregation
functions. A pre-aggregated CTE joined one-to-one to the root is useful when
the same aggregate is needed in filtering, ordering, and projection.

The key invariant is **one output row per logical API item before
pagination**. A direct one-to-many join multiplies the root and makes a root
identifier insufficient for deterministic page boundaries. Aggregate the many
side first, use a correlated projection, or declare a unique tuple for the
actual result rows when those multiplied rows are themselves API items.

## Performance and refinement

The default relation strategy stays in one root statement and maps well to
indexed correlated checks, but a single statement can still contain repeated
work:

- `hasAny` and `hasNone` use one correlated check with an `in` list;
- `hasAll` uses one check per distinct requested value;
- `.count()` can be repeated in filtering, ordering, cursor selection, and the
  consumer projection;
- every requested value consumes a bound parameter.

For the example, useful starting indexes are `tags(slug)`,
`application_tags(application_id, tag_id)`,
`application_tags(tag_id, application_id)`, and `orders(application_id)`. Put
tenant keys first when tenant isolation participates in every predicate.

Large `hasAll` requests, repeated aggregates, and analytics are candidates for
a consumer-owned CTE or pre-aggregation. Expose the reduced result through
`expr.*`, add its CTE/join to the base builder, and either use `select.apply`
or place the select fragments individually. This package supplies the reliable
default strategy; the consumer remains free to optimize a specific dialect and
query plan. Inspect emitted SQL and the database's `EXPLAIN` output for
production shapes.

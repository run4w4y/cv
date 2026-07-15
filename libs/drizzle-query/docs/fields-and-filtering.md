# Fields and filtering

`defineQuery` infers column names and values from its table argument. The array
returned by the field callback is the endpoint contract: `.filterable()` and
`.sortable()` opt each field into the corresponding request capability.

```ts
const query = defineQuery(
  applications,
  ({ col }) => [
    col.id.filterable().sortable({ unique: true }),
    col.name.filterable().sortable(),
    col.status.filterable(),
    col.deletedAt.filterable(),
    col.internalNote,
  ],
  { pagination: pagePagination() },
)
```

Here `id`, `name`, `status`, and `deletedAt` are available to typed filter
requests. `internalNote` is part of the definition metadata but exposes
neither filtering nor ordering.

For tables where most scalar columns use their inferred behavior, call the
column catalog and spread the result. Exclude only fields whose semantics need
an explicit override:

```ts
({ col }) => [
  col.id.filterable().sortable(),
  ...col({ exclude: ['id', 'status', 'internalNote'] }),
  col.status.filterable().sortable({ values: statusValues }),
]
```

The catalog enables filtering for inferred scalar and enum columns, enables
ordering where the database type has an intrinsic order, and skips opaque
custom columns. Enum ordering remains explicit because its semantic rank is
consumer-owned.

## Inferred capabilities

Defaults come from Drizzle column metadata rather than field-name conventions:

| Column kind | Default filter operators |
| --- | --- |
| plain text | `eq`, `ne`, `in`, `notIn`, `contains`, `notContains`, `startsWith`, `endsWith` |
| enum | `eq`, `ne`, `in`, `notIn` |
| number, bigint, date/time | equality/list operators plus `gt`, `gte`, `lt`, `lte`, `between`, `notBetween` |
| boolean | `eq`, `ne` |
| constrained string, such as UUID or network types | `eq`, `ne`, `in`, `notIn` |
| nullable | scalar defaults plus `isNull`, `isNotNull` |
| JSON or unknown custom type | no scalar defaults; nullable fields retain null checks |

Specialized Drizzle string types deliberately do not inherit text-containment
semantics. Text containment escapes `%`, `_`, and `\`, so its value is treated
as a literal. An empty `in` list is false and an empty `notIn` list is true.

Enum ordering is not inferred from database collation and therefore requires
an explicit rank:

```ts
col.status
  .filterable()
  .sortable({ values: ['draft', 'active', 'archived'] })
```

Use `.sortable({ unique: true })` when one enabled, non-null field uniquely
identifies a result row. Use `uniqueBy` for composite identity:

```ts
defineQuery(
  applications,
  ({ col }) => [col.tenantId.sortable(), col.id.sortable()],
  {
    pagination: cursorPagination(),
    defaultOrderBy: [{ field: 'tenantId' }, { field: 'id' }],
    uniqueBy: [['tenantId', 'id']],
  },
)
```

## Typed filter requests

Top-level nodes are combined with `and`. Groups support `and`, `or`, and
`not`; `and` and `or` require at least one child, while `not` has exactly one.

```ts
const resolved = query.resolve({
  filters: [
    {
      type: 'condition',
      field: 'status',
      operator: 'in',
      value: ['active'],
    },
    {
      type: 'group',
      combinator: 'or',
      children: [
        {
          type: 'condition',
          field: 'name',
          operator: 'contains',
          value: 'studio',
        },
        {
          type: 'condition',
          field: 'deletedAt',
          operator: 'isNull',
        },
      ],
    },
  ],
})
```

Binary operators require a typed `value`; unary operators have no `value`.
Those names describe request arity, not the shape of the generated SQL.

`resolve` accepts a typed `QueryRequest`; it is not a transport validator.
Decode and validate URL parameters, JSON, dates, bigint values, enums, and
custom operator values before calling it. This keeps Effect Schema, Zod, and
other validation choices outside the core package. The resolver still reports
semantic inconsistencies, such as a target that is not part of the active
definition, with `QueryError`.

## Extending, disabling, and replacing operators

The operator array passed to `.filterable(...)` is authoritative. There is no
hidden registry merge. A consumer can transform the inferred defaults or
supply the complete array directly.

```ts
import { sql } from 'drizzle-orm'
import {
  appendOperators,
  binaryFilterOperator,
  replaceOperator,
  unaryFilterOperator,
  withoutOperators,
} from '@cv/drizzle-query'

const caseInsensitiveEq = binaryFilterOperator<'eq', string>('eq', {
  compile: ({ expression, value, bind }) =>
    sql`lower(${expression}) = lower(${bind(value)})`,
})

const longerThan = binaryFilterOperator<'longerThan', number>('longerThan', {
  compile: ({ expression, value }) =>
    sql`length(${expression}) > ${sql.param(value)}`,
})

const isNonBlank = unaryFilterOperator('isNonBlank', {
  compile: ({ expression }) => sql`length(trim(${expression})) > 0`,
})

const name = col.name.filterable((defaults) =>
  appendOperators(
    replaceOperator(
      withoutOperators(defaults, ['notContains', 'endsWith']),
      caseInsensitiveEq,
    ),
    [longerThan, isNonBlank],
  ),
)
```

This declaration:

- disables `notContains` and `endsWith`;
- overloads the default `eq` implementation without changing its request name;
- adds one binary and one unary operator.

`pickOperators`, `withoutOperators`, `replaceOperator`, and
`appendOperators` work on arrays while preserving literal operator names in
the inferred request type. Replacement retains the existing name. When an
appended operator repeats an existing name, the later declaration becomes the
authoritative implementation. `normalizeOperators` applies the same
last-declaration-wins rule to any operator array.

For a field with no useful defaults, pass its full capability array:

```ts
const hasKind = binaryFilterOperator<'hasKind', string>('hasKind', {
  compile: ({ expression, value }) =>
    sql`json_extract(${expression}, '$.kind') = ${sql.param(value)}`,
})

col.payload.filterable([hasKind])
```

`compile` receives the value type declared by the operator and returns a
Drizzle `SQL` expression. Use the provided `bind(value)` when the right-hand
side has the field's database representation; it uses the backing column's
Drizzle encoder. Use `sql.param(...)` for a different logical value such as
the numeric length above. Keep identifiers and SQL syntax static—request data
belongs in bound parameters, never in `sql.raw`.

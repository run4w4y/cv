# Drizzle query UI

Metadata-driven React filters for `@cv/drizzle-query`. The package derives
available fields, operators, and value editors from a query definition and
emits the recursive filter nodes understood by the server query layer.

Date descriptors use the segmented calendar and date-time controls from
`@cv/internal-ui`. Two-date tuple descriptors render as a single date-time
range editor, while values remain UTC ISO strings at the query transport
boundary.

Editor state and applied query state remain separate.
`resolveQueryFiltersState` keeps incomplete conditions available for correction
without applying them to a request.

Field presentation can customize labels, descriptions, visibility, initial
values, and suggestion labels. It cannot add, remove, or redefine operators or
their operand types; those capabilities always come from the query definition.

The `@cv/drizzle-query-ui/search-params` entry point adapts a schema-composed
API codec to browser `URLSearchParams`. It preserves valid and invalid query
states and provides the shared table sorting bridges. It does not redefine
fields, operators, operand codecs, or ordering validation.

Compact browser URLs use `filter` and `sort`, for example:

```text
?filter=listingAvailability:ne:closed;applicationStatus:notIn:[rejected,withdrawn]&sort=applicationStatus:desc
```

## Storybook

The colocated stories use application-registry-shaped Drizzle query metadata
and the actual `@cv/internal-ui` Tailwind v4 theme.

```sh
nx run drizzle-query-ui:storybook:dev
nx run drizzle-query-ui:storybook:build
```

Tests are colocated beside their implementation with the same basename:
`model.test.ts`, `query-filters.test.tsx`, and `value-editor.test.tsx`.

# Drizzle query UI

Metadata-driven React filters for `@cv/drizzle-query`. The package derives
available fields, operators, and value editors from a query definition and
emits the recursive filter nodes understood by the server query layer.

Date descriptors use the segmented calendar and date-time controls from
`@cv/internal-ui`. Two-date tuple descriptors render as a single date-time
range editor, while values remain UTC ISO strings at the query transport
boundary.

Browser state is handled in two phases: URL decoding first reconstructs
structural editor state, then
`resolveQueryFiltersState` checks every condition against the authoritative
field/operator/value metadata. Only `validState` (or
`filterNodesFromState(state, definition, presentation)`) should be sent to an
API; incomplete and invalid conditions remain available for correction in the
editor.

Field presentation can customize labels, descriptions, visibility, initial
values, and suggestion labels. It cannot add, remove, or redefine operators or
their operand types; those capabilities always come from the query definition.

The query codec uses the same canonical value as the API:
`filters=<JSON FilterNode[]>`. It preserves recursive AND, OR, and NOT groups,
validates the complete payload before it can be forwarded, and rejects
malformed or duplicate `filters` parameters.

## Storybook

The colocated stories use application-registry-shaped Drizzle query metadata
and the actual `@cv/internal-ui` Tailwind v4 theme.

```sh
nx run drizzle-query-ui:storybook:dev
nx run drizzle-query-ui:storybook:build
```

Tests are colocated beside their implementation with the same basename:
`model.test.ts`, `query-filters.test.tsx`, and `value-editor.test.tsx`.

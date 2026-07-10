# @cv/content-authoring-utils

React and MDX helpers for app-owned content authoring components.

The package gives apps a small toolkit for defining portable authoring
components, identifying those components inside MDX trees, extracting text, and
collecting structured blocks for composition.

## Use For

- `defineAuthoringComponent` wrappers exposed through `virtual:content`.
- MDX block extraction from React nodes.
- Heading/list/text helpers used by app-specific composers.

## Boundary

The package is not CV-specific. It does not know which authoring components an
app exposes or how extracted blocks become final content. `apps/cv` supplies
those definitions in `src/cv-content/authoring/*`.

## Verification

```bash
bunx nx run content-authoring-utils:typecheck
bunx nx run content-authoring-utils:test:unit
```

# @cv/ui

Shared React UI primitives for the workspace. Components are small wrappers around Base UI primitives plus the workspace Tailwind tokens.

## Components

- `Button`: button primitive with default, outline, secondary, ghost, destructive, link, and navigation variants.
- `Tabs`: root, list, trigger, and content primitives with default and line list styling.
- `Toggle`: single pressed/unpressed control with default, outline, and content variants.
- `ToggleGroup`: grouped toggles for single- or multi-select segmented controls.
- `cn`: class name merge helper using `clsx` and `tailwind-merge`.

## Imports

Prefer package exports instead of deep relative paths:

```tsx
import { Button, Tabs, TabsContent, TabsList, TabsTrigger } from '@cv/ui'
import { Toggle } from '@cv/ui/toggle'
import { ToggleGroup, ToggleGroupItem } from '@cv/ui/toggle-group'
```

## Storybook

Library Storybook runs from `libs/ui/.storybook` and discovers colocated stories in `libs/ui/src`.

```sh
nx run ui:storybook:dev --skip-nx-cache
nx run ui:storybook:build --skip-nx-cache
nx run ui:storybook:static --skip-nx-cache
```

The `storybook:dev` target starts the dev server on port `4400`. `storybook:build` writes the static build to `libs/ui/storybook-static`. `storybook:static` serves that directory through the Nx web file server.

## Contributing

- Keep components split by primitive; add stories beside the component they document.
- Export public components from `src/index.ts` and add package subpath exports when a direct import is useful.
- Reuse Base UI primitives and existing Tailwind token names before adding new component state.
- Keep stories focused on meaningful states, variants, sizes, and orientation rather than one large demo page.
- Run lint, typecheck, build, and Storybook build when Storybook dependencies are installed.

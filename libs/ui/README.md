# @cv/ui

Shared React UI primitives for the workspace.

Components are small wrappers around Base UI primitives plus the workspace
Tailwind tokens. Keep this package focused on reusable primitives; app-specific
CV layout and content rendering belongs in `apps/cv`.

## Components

- `Button`: default, outline, secondary, ghost, destructive, link, navigation,
  and toolbar-oriented variants.
- `Tabs`: root, list, trigger, and content primitives.
- `Toggle`: single pressed/unpressed control.
- `ToggleGroup`: grouped single- or multi-select segmented controls.
- `cn`: class name merge helper using `clsx` and `tailwind-merge`.

## Imports

Prefer package exports instead of deep relative paths:

```tsx
import { Button, Tabs, TabsContent, TabsList, TabsTrigger } from '@cv/ui'
import { Toggle } from '@cv/ui/toggle'
import { ToggleGroup, ToggleGroupItem } from '@cv/ui/toggle-group'
```

## Storybook

Library Storybook runs from `libs/ui/.storybook` and discovers colocated stories
in `libs/ui/src`.

```bash
bunx nx run ui:storybook:dev
bunx nx run ui:storybook:build
bunx nx run ui:storybook:static
```

`storybook:dev` starts on port `4400`. `storybook:build` writes to
`libs/ui/storybook-static`. `storybook:static` serves that directory through the
Nx web file server.

## Verification

```bash
bunx nx run ui:typecheck
bunx nx run ui:build
bunx nx run ui:storybook:build
```

# @cv/color-scheme

Shared light/dark/system color-scheme runtime.

The package stores and applies a selected color-scheme preference, observes the
system preference, provides Astro boot/runtime scripts, and exposes React hooks
for app controls.

## Imports

- `@cv/color-scheme`: framework-neutral core and DOM helpers.
- `@cv/color-scheme/astro`: compiled Astro boot/runtime scripts.
- `@cv/color-scheme/react`: React hook for color-scheme controls.
- `@cv/color-scheme/script`: framework-neutral pre-paint boot script.

## Verification

```bash
bunx nx run color-scheme:typecheck
bunx nx run color-scheme:test:unit
```

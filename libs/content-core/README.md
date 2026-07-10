# @cv/content-core

Shared content vocabulary for the workspace.

This package defines generic runtime contracts that are reused by the content
pipeline, private-content runtime, app code, and tools. It intentionally does
not own the CV app's final content schema, filesystem discovery, React
rendering, or encryption implementation.

## Provides

- Effect Schema decoders for content manifests, variables, overlays, and file
  indexes.
- Shared `Locale`, `ProfileSlug`, JSON, variable, redaction, and overlay types.
- Refined locale/profile/variable identifiers that are safe as record keys and
  path segments.
- A branded `WebBaseUrl` schema that accepts HTTP(S) URLs, normalizes deployment
  paths as directories, and resolves paths without allowing origin or base-path
  escape.
- `collectVariableUseDescriptors`, which lets an app-specific privacy adapter
  discover redacted variables inside composed content.

## Boundary

`@cv/content-core` is schema infrastructure, not an app content model. The CV
sections and entry shapes live in `apps/cv/src/cv-content/schema/*`; a forked app
can replace those schemas while keeping this package.

## Verification

```bash
bunx nx run content-core:typecheck
bunx nx run content-core:lint
```

# @cv/content-build

Build-time artifact generation for authored content.

This package validates build inputs, composes content snapshots, creates
deterministic public ids, emits public files, encrypts private files, infers
private runtime profile payloads, and exposes helpers for minting private
audience links.

## Inputs

- `CONTENT_ROOT`: content repository root.
- `CONTENT_ID_SALT`: salt used to derive opaque public ids.
- Optional private build secrets, especially `PRIVATE_CONTENT_ROOT_KEY`, when
  encrypted private runtime artifacts should be emitted.
- An app-owned `ContentContract` from `@cv/content-composer`.

## Outputs

- A public content manifest and generated runtime modules.
- Public files copied below `/files/...`.
- Encrypted private files below `/_content/files/...`.
- Private runtime profile chunks keyed by derived token selectors.
- Private profile route metadata used by dev tools and PDF/export workflows.

## Boundary

`@cv/content-build` does not read Infisical, know the CV schema, or decide where
secrets come from. Callers pass resolved config, an app contract, and optional
private secrets.

## Verification

```bash
bunx nx run content-build:typecheck
bunx nx run content-build:test:unit
```

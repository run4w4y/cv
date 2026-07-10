# @cv/private-content-session

Runtime session helpers for browser private-content experiences.

The package models public, loading, unlocked, invalid, and unavailable sessions.
It reads an access token, verifies the private capability token, selects the
private runtime profile chunk, opens encrypted payloads through
`@cv/private-content-protocol`, applies private overlays, and returns private
file keys for unlocked sessions.

## File Resolution

The session runtime also owns generated content file URL resolution:

- public files live below `/files/...`;
- encrypted private files live below `/_content/files/...`;
- private files are opened only after an unlocked session provides the relevant
  profile file keys.

## Boundary

This package is app-agnostic session machinery. The CV app supplies page
context, browser token reading, React state, and rendering behavior in
`apps/cv/src/lib/private-content-session/*`.

## Verification

```bash
bunx nx run private-content-session:typecheck
bunx nx run private-content-session:test:unit
```

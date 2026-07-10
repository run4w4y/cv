# @cv/private-content-protocol

Private content runtime manifest contracts, validation, and encryption helpers.

Build tooling infers private profile payloads from composed content and
caller-supplied secrets before using this package to produce encrypted runtime
manifests. Browser runtime code uses the same package to decode manifest shapes
and open encrypted profile entries.

## Responsibilities

- Build encrypted runtime manifests from inferred private profile input.
- Decode runtime manifests and decrypted profile payloads at package boundaries.
- Expose stable associated-data strings for encrypted profile payloads and
  profile-scoped private files.
- Expose private runtime types without coupling them to Astro routes, browser
  sessions, or a concrete content schema.

## Non-Responsibilities

- Token minting or verification: `@cv/private-content-tokens`.
- App private URL shape and token placement: the app and link tooling.
- Browser session state and public fallback behavior:
  `@cv/private-content-session`.
- App-specific content schema or rendering: `apps/cv`.

## Verification

```bash
bunx nx run private-content-protocol:typecheck
bunx nx run private-content-protocol:test:unit
```

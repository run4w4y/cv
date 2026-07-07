# @cv/private-content-protocol

Private content runtime manifest contracts, validation, and encryption helpers.

This package contains code only. Build tooling infers private profile payloads
from content profiles and caller-supplied secrets before calling these runtime
helpers.

## Responsibilities

- build encrypted runtime manifests from inferred private profile input
- decode runtime manifests and decrypted profile payloads at package boundaries
- expose stable associated-data strings for encrypted profile payloads and
  profile-scoped private files
- expose private runtime types without coupling them to the Astro app, browser
  sessions, or route structure

## Non-Responsibilities

- private capability token minting or verification; that belongs to
  `@cv/private-content-tokens`
- app private-link URL shape and query/hash token placement; that belongs to the
  app and build/link tooling
- runtime session state, public fallback behavior, and file URL resolution; that
  belongs to `@cv/private-content-session`

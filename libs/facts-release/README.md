# `@cv/facts-release`

Deterministic compiler and publication boundary for reviewed CV facts.

The compiler accepts the complete set of configured single-locale
`cv.facts.v1` catalogues, exact asset bytes, and immutable source/compiler
provenance. It validates every catalogue through `@cv/contracts/facts`, rejects
duplicate locales, verifies every declared asset digest, canonicalizes unordered
release metadata, and emits content-addressed opaque objects under
`sha256/<digest>`. All configured locales are published and activated as one
atomic release.

The release manifest contains only facts-contract metadata, provenance, and
object descriptors. The release ID is `fr_<manifest-sha256>`, so no manifest
contains its own address and no clock participates in compilation. A UTC
publication timestamp is added only when building the registry registration.

```ts
import {
  compileFactsRelease,
  makeFactsReleaseRegistration,
  publishFactsRelease,
} from '@cv/facts-release'
```

`publishFactsRelease` uses an Effect `FactsReleasePublicationTarget`: it
verifies the bundle again, uploads all immutable objects, and registers the
release only after every upload succeeds. Network, R2, and registry-client
adapters remain outside this package.

This package imports the facts contract and deliberately never imports the CV
document contract or registry persistence packages.

## Verification

```bash
bunx nx run facts-release:typecheck
bunx nx run facts-release:test:unit
```

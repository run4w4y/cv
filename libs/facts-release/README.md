# `@cv/facts-release`

Deterministic compiler and bundle-verification boundary for reviewed CV facts.

The compiler accepts composer-validated `cv.facts.v1` catalogues, required
`cv.generation-guidance.v1`, exact asset bytes, and immutable source/compiler
provenance. It emits a `cv.facts-release.v2` manifest whose release ID is
`fr_<manifest-sha256>`, so identical inputs produce identical objects.

`compileFactsReleaseBundle` serializes the complete immutable object set into
`cv.facts-bundle.v1`. `verifyFactsReleaseBundle` checks the strict schema,
object hashes and lengths, addressed manifest, catalogue/guidance descriptors,
assets, and exact key set before any storage write is possible.

The static layout is `current.json`,
`releases/<release-id>/manifest.json`,
`releases/<release-id>/locales/<locale>.json`, and
`releases/<release-id>/generation/cv.json`, plus
`assets/sha256/<digest>`. Only the registry service may create immutable
objects and compare-and-set `current.json`; this package has no network or object-store
publisher abstraction.

There is no older-manifest compatibility path.

```bash
bunx nx run facts-release:typecheck
bunx nx run facts-release:test:unit
```

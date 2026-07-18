# Facts release publisher

Compiles a checked-out `cv-content` facts source into deterministic,
content-addressed objects with `@cv/facts-release`, publishes the exact bytes to
the private registry API, registers immutable release metadata, and advances a
versioned facts channel.

The source checkout must contain `facts/catalogue.json` and one file in
`facts/assets/` for every declared asset. Asset files are named
`<asset-id>.<extension>`.

Required environment variables:

- `FACTS_CONTENT_ROOT`
- `FACTS_SOURCE_COMMIT`
- `FACTS_COMPILER_COMMIT`
- `REGISTRY_API_URL`
- `REGISTRY_API_TOKEN`

Optional variables select the repositories and channel:
`FACTS_SOURCE_REPOSITORY`, `FACTS_COMPILER_REPOSITORY`, and `FACTS_CHANNEL`.
Both commits must be full lowercase 40- or 64-character hexadecimal IDs.

The production repository-dispatch workflow also verifies that the requested
source commit is still `run4w4y/cv-content`'s authoritative `main` head
immediately before invoking the publisher. This prevents an older queued push
from superseding a newer active release. Manual workflow dispatch remains an
explicit operator override for publishing a historical exact commit.

The command logs release hashes, counts, and channel state only. It never logs
the bearer token, catalogue, asset bytes, or registry response bodies.

```sh
bunx nx run facts-release-publisher:publish
```

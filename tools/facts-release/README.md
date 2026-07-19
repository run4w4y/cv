# Facts release publisher

Compiles a checked-out `cv-content` facts source into deterministic,
content-addressed objects with `@cv/facts-release`, publishes the exact bytes to
the private `cv-facts` R2 bucket, and replaces `current.json` only after every
immutable release object has been verified and uploaded.

The source checkout is a human-authored TypeScript repository. Its
`facts.config.ts` is the source of truth for `defaultLocale`, `factsDir`, and the
complete locale list. For every configured locale, the publisher loads root
`section.ts` files and `section/index.ts` entrypoints. An index may import any
number of entry modules from its directory; those imports are not treated as
standalone sections. Locale trees must have the same semantic section, entry,
workstream, contribution, and fact structure. Authors do not maintain internal
catalogue IDs; composition derives them from normalized structural paths.
Technology arrays are locale-invariant and must match the default locale
exactly.

Optional shared registries live at `<factsDir>/evidence.ts` and
`<factsDir>/assets.ts`. Reviewed binary assets live in `<factsDir>/assets/`; the
publisher computes their digests from the bytes instead of asking authors to
maintain hashes. Vite is used only to evaluate these TypeScript modules. There
is no MDX/component runtime and no authored catalogue JSON.

Portable `virtual:facts` authoring types are generated from the code-owned
schema in this repository:

```sh
bunx nx run facts-types:generate
```

Required environment variables:

- `FACTS_CONTENT_ROOT`
- `FACTS_SOURCE_COMMIT`
- `FACTS_COMPILER_COMMIT`
- `FACTS_R2_ACCOUNT_ID`
- `FACTS_R2_BUCKET`
- `FACTS_R2_ACCESS_KEY_ID`
- `FACTS_R2_SECRET_ACCESS_KEY`

Optional variables select the repositories: `FACTS_SOURCE_REPOSITORY` and
`FACTS_COMPILER_REPOSITORY`. Both commits must be full lowercase 40- or
64-character hexadecimal IDs.

The production repository-dispatch workflow also verifies that the requested
source commit is still `run4w4y/cv-content`'s authoritative `main` head
immediately before invoking the publisher. This prevents an older queued push
or a historical manual request from superseding the reviewed main release.

The command logs release hashes, counts, and pointer state only. It never logs
S3 credentials, catalogue content, or asset bytes.

```sh
bunx nx run facts-release-publisher:publish
```

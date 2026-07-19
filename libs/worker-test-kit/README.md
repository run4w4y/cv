# Worker test kit

Shared Miniflare infrastructure for Worker-facing tests. The package owns
repeatable lifecycle and storage behavior; each consumer keeps its scenario
inputs and assertions.

Use the narrowest entry point:

- `@cv/worker-test-kit/miniflare` provides the generic environment, migration,
  module-loading, and D1/KV/R2 reset utilities.
- `@cv/worker-test-kit/application-registry` provides D1-only and built-Worker
  harnesses, registry bindings, deterministic factories, and seed helpers.
- `@cv/worker-test-kit/cv-public` runs the built Astro Worker against an
  in-process publication resolver service.

Every environment creates isolated temporary persistence and removes it on
`dispose()`. `restart()` preserves persisted data for restart tests. Registry
harnesses also provide `reset()` for suite-level reuse when isolation has been
verified for that suite.

## Generated test data

Registry factories use Faker, but they are intentionally not global random
generators. Each record is derived from the explicit test seed, record scope,
and sequence, then decoded by the real API schema. A failure can therefore be
replayed with the same seed, and contract drift fails at data construction
rather than deep inside a test.

```ts
const factory = makeRegistryFactory({
  seed: 7171,
  now: '2026-07-18T00:00:00.000Z',
})

const application = factory.application({
  applicationStatus: 'not_started',
})
```

Prefer `seedRegistryThroughService` when a test is intended to cover defaults,
validation, idempotency, or other behavior. Its `persist` callback can invoke
an Effect service with `Effect.runPromise` or call the typed HTTP client. It is
sequential by default and accepts bounded concurrency for larger scenarios.

```ts
await seedRegistryThroughService({
  applicationCount: 20,
  factory,
  persist: (input) => Effect.runPromise(applications.upsert(input)),
})
```

Use `factory.graph()` with `seedRegistryDatabase` only when the behavior under
test is a read path such as filtering, cursor pagination, or facet aggregation.
That mode builds entity-typed Drizzle inserts and sends them through bounded D1
batches, so table defaults and JSON column mappings stay aligned with the
production schema. It can cheaply create hundreds of related applications and
events, but deliberately bypasses service behavior.

Keep a small explicit example when exact bytes, malformed input, a migration
edge case, or a legally meaningful value is the assertion. Generated data is a
replacement for repetitive bulk fixtures, not for every named example.

## Verification

The package tests real migrations and storage cleanup against Miniflare and has
a parity check for the application-registry Wrangler bindings.

```sh
bunx nx run worker-test-kit:test:unit
bunx nx run worker-test-kit:test:integration
```

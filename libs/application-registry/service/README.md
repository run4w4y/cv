# Application registry service

Slice-oriented Effect services for registry workflows. The package root exports
stable service interfaces, Context keys, inputs, outputs, and errors. Consumers
can build programs entirely against those contracts. Concrete workflow Layers
are available separately from `@cv/application-registry-service/live` and are
installed only by runtime composition roots.

This package owns IDs, replay and conflict handling, explicit status
transitions, pagination cursors, and coordination across CRUD and FX services.
It contains no HTTP, D1, or Drizzle implementation concerns.

The public services are split by registry slice:

- `ApplicationsService` owns application upsert, patch, lookup, deletion, and
  paginated listing workflows, plus label replacement on an application.
- `AnnotationsService` owns annotation lookup and idempotent note creation.
- `CapturesService` owns idempotent campaign capture ingestion.
- `EventsService` owns idempotent event append and event pagination.
- `CompensationsService` owns original and converted compensation views.

Event status changes are explicit. Status-changing kinds (`submitted`,
`stage_changed`, `interview_scheduled`, `rejected`, `withdrawn`, and
`offer_received`) carry `nextApplicationStatus`; the service passes that value
to the atomic projection/event write. Informational kinds (`note_added`,
`contact_logged`, `follow_up_scheduled`, and `research_updated`) omit it and
leave the projection status unchanged. No event-name-to-status conversion is
hidden in the service.

Unit tests live beside the `/live` implementations and replace CRUD, IDs, and FX
dependencies with `Layer.succeed` fakes. `test/service.integration.test.ts`
composes the live services with the real D1 CRUD Layers and a Miniflare binding,
without making network FX requests. The integration suite owns workflow-level
coverage for idempotency and operation conflicts, concurrent job-key
convergence, capture merge policy, database defaults, nullable patches,
optimistic races, explicit lifecycle transitions, atomic rollback, and
checkpoint advancement.

```bash
bunx nx run application-registry-service:test:unit
bunx nx run application-registry-service:test:integration
```

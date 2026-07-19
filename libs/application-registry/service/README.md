# Application registry service

Slice-oriented Effect workflows for the registry. The package root exports
service contracts and errors; concrete Layers are exported from
`@cv/application-registry-service/live`.

The service owns optimistic concurrency, idempotent replay, URL normalization,
status update semantics, backend activities, and coordination across CRUD,
artifact storage, listing checks, analytics, and FX services. It contains no
HTTP routing or D1 binding code.

Key services are:

- `ApplicationsService`: UUID creation, normalized posting deduplication,
  lookup/listing, and one aggregate update for scalar fields, labels, and annual
  compensation;
- `ActivitiesService`: read-only per-application and registry-wide history;
- `AnnotationsService`: annotation reads and idempotent note creation;
- `ListingChecksService`: findings, runs, grace windows, and safe archival;
- `OpaqueObjectsService`: schema-free content-addressed bytes;
- `JobPostingSnapshotsService`: immutable raw/normalized posting context;
- `ContentEntriesService`: linear opaque revisions and head approval;
- `CvPublicationsService`, `CvAnalyticsService`, and `PdfArtifactsService`:
  stable publications, traffic, and exact PDF artifacts.

Activities are annotations, not authoritative commands. Application creation,
aggregate updates, notes, and listing decisions issue them from the backend as
part of the same persistence operation. Clients never ask the service to append
an arbitrary activity.

List workflows accept the request inferred from the entity package's
`drizzle-query` definition and return standard `{ items, pageInfo }` cursor
pages. No alternate filter or ordering syntax is maintained here.

Content services inspect only contract IDs, media types, hashes, byte lengths,
release IDs, and locales. Document field validation stays with the management
and rendering boundaries. Facts are read and verified directly by the
management client, not this service. Payload bytes remain opaque.

```bash
bunx nx run application-registry-service:test:unit
bunx nx run application-registry-service:test:integration
```

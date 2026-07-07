# analytics-core

`analytics-core` is the privacy boundary and shared data model for the CV
analytics UI and CLI. Public consumers should import from `src/index.ts`; module
files under `src` keep the implementation focused and testable.

## Data Model

Dashboard data uses schema `analytics.dashboard.v1` and version `1`.
The top-level payload contains:

- `paths`: sanitized path records with page-view, visit, visitor totals,
  time-series points, path kind, optional locale/audience ID, and aggregate
  dimensions for referrers, countries, and devices.
- `audiences`: audience summaries derived from `/en/a/<audience-id>/` and
  `/ru/a/<audience-id>/` paths. The audience id is an opaque compact encrypted
  slug in production and can be decoded by the analytics connector with
  `PRIVATE_CONTENT_AUDIENCE_KEY`.
- `range`: the date span represented by the input rows.
- `summary`: public, audience, active-audience, and zero-visit counts.

`types.ts` owns the TypeScript shape. `constants.ts` owns the schema string.

## Sanitizer Boundary

`sanitizeAnalyticsInput` accepts unknown raw analytics input and returns
`AnalyticsDashboardData`. The sanitizer recursively finds rows that expose a
known path dimension, reads Cloudflare-style metrics and dimensions, normalizes
paths, aggregates totals, sorts output deterministically, and drops unsafe
dimension values.

The sanitizer is intentionally lossy: anything not needed by the dashboard is
ignored. Callers should treat its return value as the only data safe to persist
or render publicly.

## Privacy Guarantees

`privacy.ts` centralizes token, email, and IPv4 detection so leakage checks are
not duplicated across modules. The package strips private content tokens from paths,
rejects unsafe serialized dashboard payloads, and avoids copying suspicious raw
fields such as query strings, URLs, user agents, cookies, authorization headers,
emails, and IP addresses into sanitized output.

The public dashboard format must not contain:

- private content token query parameters such as `?p=...`;
- raw email addresses;
- raw IPv4 addresses;
- raw user-agent strings or other unaggregated request metadata.

## Raw Cloudflare Shape Assumptions

Raw rows may be nested arrays or objects. A row is considered analytics input
when it has one of the known path fields directly or inside `dimensions`:
`clientRequestPath`, `path`, `requestPath`, `pagePath`, or `metric`.

Metrics are read from common aggregate fields such as `sum.pageViews`,
`sum.requests`, `sum.visits`, `pageViews`, `requests`, `visits`, `sessions`,
`uniq.visitors`, `uniq.uniques`, `visitors`, and `uniques`. Date buckets are
read from `datetimeHour`, `datetimeDay`, `date`, `at`, or `bucket`.

Dimension names are intentionally narrow:

- referrers: `refererHost`, `referer`, `referrer`;
- countries: `country`, `clientCountryName`, `countryName`;
- devices: `device`, `deviceType`, `clientDeviceType`.

## Colocated Tests

Tests live next to the module they cover as `*.test.ts` under `src`. Do not add a
separate `test/` directory for this package. Shared public behavior should still
be exported through `src/index.ts`, but tests should import the local module when
they are exercising module-specific behavior.

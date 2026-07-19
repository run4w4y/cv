# Application registry management

React Router application for inspecting and filtering the application registry.
The table is authored in this app with TanStack Table; reusable management
primitives live in `@cv/internal-ui`, while `@cv/drizzle-query-ui` renders filter
controls directly from the registry query definition's field metadata.

Registry timestamp fields publish date and range descriptors through the query
definition. The app supplies their management labels and defaults them to
date-time comparisons, so calendar controls are used without app-owned value
conversion.

## Development

Start the API and UI from the repository shell:

```bash
bunx nx run application-registry-api:dev
bunx nx run application-registry-management:dev
```

The Vite development server proxies `/api/registry` to `REGISTRY_API_URL` and
adds `REGISTRY_API_TOKEN` server-side. The token is never included in the
browser bundle. A production host must provide the same authenticated reverse
proxy path, or rewrite it to an equivalent same-origin backend-for-frontend.

Reviewed facts are intentionally different: the app signs direct GET requests
to the private facts bucket with `VITE_FACTS_R2_ACCOUNT_ID`,
`VITE_FACTS_R2_BUCKET`, `VITE_FACTS_R2_ACCESS_KEY_ID`, and
`VITE_FACTS_R2_SECRET_ACCESS_KEY`. That permanent credential is embedded in
this owner-only application and is scoped to Object Read on that bucket only.
The app verifies the current pointer, manifest, locale catalogue, media types,
byte lengths, and SHA-256 digests before using the catalogue.

## Application preparation workflows

URL-driven CV and cover-letter preparation is orchestrated in the browser by
Effect's unstable Workflow module. The application root owns session-scoped
`WorkflowEngine.layerMemory` runtimes for document preparation and CV
publication. The `/preparation/batch`
screen can start several URLs at once; three workflow activities may execute
concurrently and the shared AI provider admits at most two model calls at a
time. Admission is capped at 25 unique URLs per batch. A batch reserves all of
its runs atomically before starting any of them, and bounded activity timeouts
keep one stalled dependency from retaining a permit forever.

Each run has schema-checked input, output, activities, and tagged errors. The
workflow captures the canonical posting through the registry API, extracts a
structured job analysis, maps requirements to reviewed fact IDs, builds section
briefs in parallel, composes and validates the document, and stores an
unapproved revision pinned to the exact facts release and job snapshot. It then
suspends on a `DurableDeferred` until the user approves or rejects that revision
from the existing preparation editor. Progress and AI usage metadata are exposed
through an Effect `SubscriptionRef` and React atoms; cancellation interrupts the
local engine fiber. One open run is admitted for each URL/application, document
kind, and locale, while review submission and cancellation use atomic,
monotonic state transitions so workflow replay cannot reopen a decided review.
Requirement IDs and evidence coverage are checked exactly, section briefs can
use only evidence-plan fact IDs, and CV structural data is checked against the
reviewed catalogue. Private contacts, employers, projects, and links are
removed before any model or evidence-planning call. Generated prose still
requires the explicit human-review gate; the code does not claim semantic proof
of prose. The final save re-reads the content-entry version and retries bounded
optimistic conflicts with the same idempotent operation ID.

Approval of a workflow candidate is owned by a durable activity rather than the
page. Before the registry is mutated, it proves that the selected revision is
the current head and is either the generated candidate or a bounded chain of
human edits descended from it, with the same entry, contract, facts release,
and job snapshot. Approval then uses the freshly read entry version and checks
the registry response.

Preparation pages consume one derived workspace atom keyed by application,
document kind, locale, and optional run ID. Registry context, heads, model
discovery, publication state, and every remote mutation are Effect query or
command atoms backed by typed `RegistryClient` services. The editor atom owns
only genuine browser-local state: a human override, the last mutation result,
and the explicit
decision to adopt a candidate whose in-memory review token was lost. Registry
heads and Workflow candidates stay in their authoritative atoms and are joined
by a pure projection; React pages do not mirror them through effects or loaded
key refs.

CV publication is a separate typed Workflow. Saving stages the current revision
on one private page record and exposes it through a capability preview. The
Workflow makes that page public by setting its `enabled` boolean, then attempts
to start PDF generation. PDF status is an independent artifact lifecycle: a
failed or missing PDF does not disable the page, and the UI can refresh or retry
it. Publication progress and cancellation are exposed through keyed atoms just
like preparation runs.

Only orchestration and transient progress are local to the browser. URL capture
remains a server boundary because arbitrary job sites are not generally
browser-readable through CORS; the capture service applies schema-based URL,
redirect, size, and timeout boundaries. PDF rendering remains a private
Cloudflare Queue consumer because it requires Browser Rendering, authoritative
A4 measurement, and content-addressed R2 writes.

The memory engines are intentional first backends. Runs and pending review
tokens do not survive refresh, HMR, tab closure/eviction, runtime disposal, or
a second tab. Saved candidate revisions, links, and ready
artifacts do survive because they are already in the registry. The Workflow
definitions and service gateways are independent of the engine, so an
IndexedDB engine can replace `WorkflowEngine.layerMemory` later without moving
orchestration to the API.

Useful checks:

```bash
bunx nx run application-registry-management:typecheck
bunx nx run application-registry-management:test:unit
bunx nx run application-registry-management:build
```

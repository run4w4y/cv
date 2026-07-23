# Preparation architecture

Preparation has six state owners. Do not copy state from one owner into
another.

| Owner                                  | Owns                                                                                         | Does not own                            |
| -------------------------------------- | -------------------------------------------------------------------------------------------- | --------------------------------------- |
| `data/`                                | Registry queries, remote mutations, cache invalidation                                       | Drafts, Workflow progress               |
| `@cv/application-preparation-workflow` | CV/letter generation execution, private review/execution handles, cancellation, run progress | React form state, publication           |
| `workflow/`                            | Browser layers, memory-engine composition, and Effect Atom adapters for the package          | Workflow invariants or generation logic |
| `publication/`                         | Public-page enablement, PDF-readiness gating, publication run progress                       | Document generation or editing          |
| `editor/` + `workspace/`               | Human document override, detached-candidate decision, pure joined read model                 | Registry heads or Workflow runs         |
| `guidance/`                            | Release-keyed local overrides of content-owned CV writing guidance                           | CV document structure or facts releases |

React routes subscribe to `preparationWorkspaceAtom` and issue commands through
identity-keyed `Atom.fn` values. Each key owns its execution and result channel;
an atomic command gate rejects duplicate clicks before React rerenders. Routes
must not synchronize registry heads or Workflow
candidates with `useEffect`, `useRef` loaded keys, or mirrored `useState`.
Command results and the synchronous claim gate are keyed by application, kind,
and locale so failures and busy state cannot leak between route identities or
let a second click replace an in-flight command.
Component-local state is reserved for actual DOM/widget lifecycles. Codex
authentication and model configuration belong to the native Codex installation
and are not mirrored into React state.

## Workflow routes

The URL workflow UI follows the same hierarchy as the runtime:

- `/workflows` is the session dashboard and groups jobs by `batchId`.
- `/workflows/new` is a three-step URL, document-settings, and preflight flow.
  Its locale selector reads the active release metadata before requesting any
  locale-specific catalogue. A release without a declared default leaves the
  selector empty; the UI never guesses one.
- `/workflows/:batchId` is the parallel job monitor. It renders compact rows,
  aggregate progress, filtering, and batch cancellation instead of one card per
  URL.
- `/workflows/:batchId/jobs/:runId` renders the append-only step timeline and
  saved artifact metadata for one job.
- The review entrypoint opens the existing document workspace in focused review
  mode. Supporting job and generation context stays available in a collapsible
  section without competing with the decision.
- `/applications/:applicationId/publish` owns CV publication readiness, PDF,
  and public availability after review.

Pure screen stories under `preparation/workflows/` cover empty, parallel,
review, failure, and confirmation states without requiring the native desktop
bridge.

## Preparation run

1. A route starts the Workflow with either a strict `ReviewedContext` source or
   a batch-only `CaptureUrl` source.
   CV starts freeze the effective release guidance, including local client
   overrides, into the typed Workflow input. Cover-letter starts carry no CV
   guidance.
2. Reviewed sources pin application, snapshot, facts release, and URL. The
   gateway rejects drift; it does not silently substitute current context.
3. The package Workflow analyzes the job, plans evidence, generates section briefs,
   composes a schema-decoded tagged document, checks its cross-object
   provenance invariants, and persists a candidate.
4. It suspends on the typed human-review deferred. Approval verifies revision
   ancestry and pins before mutating the registry.
5. The progress service projects one tagged public `PreparationRun`; execution
   IDs and review tokens remain package-private. Keyed selector atoms expose
   only the run needed by a route or card.

The engine uses `WorkflowEngine.layerMemory`. A refresh loses execution and
review tokens but not an already persisted candidate. `editor/` detects that
case from the candidate operation ID and requires an explicit decision to
release the Workflow review gate before direct approval.

## Editor workspace

`preparationWorkspaceAtom` combines the current registry bootstrap, selected
Workflow run, and keyed editor-local atom. The pure projection in
`editor/session.ts` is the only place that chooses the visible base revision and
computes validation, dirty/source state, save and approval gates, detached
state, and approval mode. `editor/atoms.ts` owns only local mutations.

CV approval depends on the document schema and review decision. The PDF event
worker owns exact A4 measurement because its Chromium process is the
authoritative print environment. A layout or generation failure is recorded on
the PDF artifact and disables only the still-current matching publication.

## Publication run

Saving a CV revision stages the single page record as private and rotates its
preview capability. The management iframe renders that protected stored
preview; unsaved browser state is never a second rendering protocol. After the
publication is enabled, the PDF worker renders the literal public URL that it
also embeds in the document's QR code.

The publication Workflow accepts an approved staged revision and enables the
exact page URL required by Chromium. That state change is authoritative even if
the best-effort `CvPublicationAvailabilityChanged` event cannot be published.
When delivered, the PDF worker consumes it and owns artifact creation,
rendering, and completion. Management treats the publication as shareable only
when that page is still enabled and its matching artifact is `ready`. An
asynchronous generation failure disables the page only when the failed artifact
still identifies the current revision, publication version, and URL. An
explicit retry publishes `PdfGenerationRequested` for the current publication
without introducing another orchestration path.

Publication execution is also memory-backed. The registry page record and every
artifact attempt remain authoritative and survive browser runtime loss.

## Where to change code

- Add or change registry I/O in `data/repository/`, then expose it through a
  query or mutation atom.
- Change the shared `not_started` → `preparing` invariant in
  `application-lifecycle.ts`; both page bootstrap and Workflow startup use it.
- Change generation orchestration, schemas, the cover-letter contract, review
  binding, and run transitions in
  `libs/application-registry/preparation-workflow/`.
- Change registry/facts/browser integration in `data/repository/` and
  `workflow/store.ts`; the package depends only on its narrow
  `PreparationStore` port.
- Change browser Workflow wiring and command/selector atoms in
  `workflow/atoms/`. These adapters call `ApplicationPreparation`; they do not
  manipulate engine execution IDs or review tokens.
- Change editor policy in `editor/session.ts` and local mutations in
  `editor/atoms.ts`.
- Keep route `render.tsx` files declarative; put commands and cohesive UI cards
  in adjacent modules.

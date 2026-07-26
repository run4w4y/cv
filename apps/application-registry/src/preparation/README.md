# Preparation architecture

Preparation has seven state owners. Do not copy state from one owner into
another.

| Owner                                  | Owns                                                                                       | Does not own                            |
| -------------------------------------- | ------------------------------------------------------------------------------------------ | --------------------------------------- |
| `data/`                                | Registry queries, remote mutations, cache invalidation                                     | Drafts, workflow progress               |
| `@cv/application-preparation-workflow` | Job-first execution, shared context work, artifact branches, review handles, cancellation  | React form state, publication           |
| `workflow/`                            | Browser layers, memory-engine composition, and Effect Atom adapters for the package        | Workflow invariants or generation logic |
| `publication/`                         | Public-page enablement, PDF-readiness gating, and publication progress                     | Document generation or editing          |
| `document-state/`                      | Original/draft lifecycle, validation, history, preview fallback, and assistant patch state | Registry queries or workflow execution  |
| `document-workspace/`                  | Semantic CV/letter editing, preview, changes, and right-rail interaction                   | Persistence or orchestration            |
| `guidance/`                            | Release-keyed local overrides of content-owned CV writing guidance                         | CV document structure or facts releases |

React routes subscribe to job and artifact projections and issue commands
through Effect Atom mutation values. Document state is scoped to the selected
artifact and is never mirrored into route query parameters. Codex
authentication and model configuration belong to the native Codex installation
and are not mirrored into React state.

## effect-state-tree development snapshot

The repository consumes commit-pinned effect-state-tree package archives from a
GitHub development snapshot. The root catalog holds the direct dependencies,
and root overrides keep their internal package graph on the same snapshot.

No adjacent effect-state-tree checkout is required. To upgrade, replace every
effect-state-tree catalog and override URL with assets from one complete
`snapshot-<full commit SHA>` release, then run `bun install` from the repository
root and commit the updated lockfile.

## Workflow routes

The AI workflow UI follows the same hierarchy as the runtime:

- `/ai-workflows` is the session dashboard and groups jobs by `batchId`.
- `/ai-workflows/new` is a three-step target, document-settings, and preflight
  flow. Pasted URLs become `PostingUrl` targets. Starting from an existing
  application resolves an `ExistingApplication` target with its application,
  job snapshot, facts release, and posting URL pins.
  Its locale selector reads the active release metadata before requesting any
  locale-specific catalogue. A release without a declared default leaves the
  selector empty; the UI never guesses one.
- `/ai-workflows/:batchId` is the parallel job monitor. It renders compact
  rows, aggregate progress, filtering, and batch cancellation.
- `/ai-workflows/:batchId/jobs/:jobId` renders one job-first activity stream:
  shared context work appears once and CV/cover-letter work branches from it.
- `/ai-workflows/:batchId/jobs/:jobId/artifacts/:kind` opens the document
  workspace for one artifact. It loads its application and revision binding
  from the authoritative job projection rather than route parameters.

Pure screen stories under `preparation/workflows/` cover empty, parallel,
review, failure, and confirmation states without requiring the native desktop
bridge.

## Preparation run

1. A route creates one job per `PostingUrl` or `ExistingApplication` target.
   Posting targets always request a CV and may also request a cover letter. CV
   requests freeze the effective release guidance, including local client
   overrides, into the typed workflow input.
2. Existing-application targets pin application, snapshot, facts release, and
   URL. The gateway rejects drift; it does not silently substitute current
   context.
3. The package Workflow captures and analyzes the job and plans evidence once.
   It then generates the CV first. A requested cover letter receives that exact
   in-memory CV document and revision, so it never polls the registry or races
   a separate workflow.
4. CV generation creates one identifier-only authoring plan before composing
   the schema-decoded document. Cover letters compose directly from the
   approved CV and selected reviewed evidence. Each artifact checks its
   invariants, persists a candidate, and suspends on its own typed human-review
   deferred. A cover-letter failure does not discard a reviewable CV. Approval
   verifies revision ancestry and pins before mutating the registry.
5. The progress service projects one `PreparationJob` with a shared track and
   typed artifact branches. Execution IDs and review tokens remain
   package-private. The UI derives a single dependency-aware activity stream
   without duplicating shared work.

### Desktop lifetime

`PreparationWorkflowProvider` is mounted once above `RouterProvider`, and
Workflow execution is handed to the memory engine with `discard: true`.
Consequently, navigating to another application, workflow, or dashboard only
changes subscribers; it does not unmount, interrupt, or cancel running jobs.
The jobs also continue while their page is not visible.

The boundary is the renderer session, not the route. The engine uses
`WorkflowEngine.layerMemory`, so refreshing/reloading the renderer, closing the
window, or quitting the desktop app loses active executions and review tokens.
An already persisted candidate remains in the registry, but resuming an
interrupted review requires a new job because the matching deferred review
handle is intentionally session-owned. Moving execution across renderer
restarts requires a durable engine and is outside the current lifetime
guarantee.

## Editor workspace

The artifact route loads the current stored revision before mounting one
`document-state/` session for the artifact lifecycle. Reopening an approved
artifact loads the exact approved revision rather than reusing the original
generated payload. The session composes Effect State Tree draft, history,
validation, and Atom adapters; it owns dirty state, undo/redo, valid-preview
fallback, and atomic path-based assistant patches.

Semantic CV and cover-letter editors render compact inline fields over that
session. Save accepts an authoritative immutable revision while preserving
edits made during the request. Approval stays bound to the selected stored
revision. Route and window navigation are blocked while a draft is dirty, and
terminal artifacts disable both manual and Codex edits.

CV fields copied from reviewed facts remain visibly read-only. A reviewer can
add experience, projects, skill groups, education, and additional details only
through compact selectors backed by the pinned facts catalogue; authored
headlines, summaries, highlights, and presentation text remain inline-editable.
The same deterministic provenance policy validates manual mutations, atomic
Codex patch batches, save callbacks, and the workflow approval boundary, which
reloads the exact selected revision before approving it.

Editable reviews require the currently active facts release and job snapshot
to match the revision's immutable source pins. Once an artifact is terminal,
the workspace reopens its exact stored revision read-only without consulting
newer active sources, so an approved CV remains viewable and publishable after
facts or job context advances.

## Publication run

Saving a CV revision stages the single page record as private and rotates its
preview capability. The document workspace preview is a local rendering of the
current valid draft; publication remains a separate action bound to the exact
approved stored revision. After publication is enabled, the PDF worker renders
the literal public URL that it also embeds in the document's QR code.

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
- Change draft, validation, history, and assistant patch policy in
  `document-state/`; change semantic document presentation in
  `document-workspace/`.
- Keep route `render.tsx` files declarative; put commands and cohesive UI cards
  in adjacent modules.

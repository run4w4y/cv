# Preparation architecture

Preparation has four state owners. Do not copy state from one owner into
another.

| Owner | Owns | Does not own |
| --- | --- | --- |
| `data/` | Registry queries, remote mutations, cache invalidation | Drafts, Workflow progress |
| `workflow/` | CV/letter generation execution, review token, cancellation, run progress | React form state, publication |
| `publication/` | Link publication, PDF polling/verification/compensation, publication run progress | Document generation or editing |
| `editor/` + `workspace/` | Human override, layout gate, detached-candidate decision, pure joined read model | Registry heads or Workflow runs |

React routes subscribe to `preparationWorkspaceAtom` and issue commands through
identity-keyed `Atom.fn` values. Each key owns its execution and result channel;
an atomic command gate rejects duplicate clicks before React rerenders. Routes
must not synchronize registry heads or Workflow
candidates with `useEffect`, `useRef` loaded keys, or mirrored `useState`.
Command results and the synchronous claim gate are keyed by application, kind,
and locale so failures and busy state cannot leak between route identities or
let a second click replace an in-flight command.
Component-local state is reserved for actual DOM/widget lifecycles, such as the
iframe preview mount, `ResizeObserver`, and the external ChatGPT login hook.

## Preparation run

1. A route starts the Workflow with either a strict `ReviewedContext` source or
   a batch-only `CaptureUrl` source.
2. Reviewed sources pin application, snapshot, facts release, and URL. The
   gateway rejects drift; it does not silently substitute current context.
3. The Workflow analyzes the job, plans evidence, generates section briefs,
   composes an exact tagged document, validates it, and persists a candidate.
4. It suspends on the typed human-review deferred. Approval verifies revision
   ancestry and pins before mutating the registry.
5. The progress service projects one tagged `PreparationRun`; keyed selector
   atoms expose only the run needed by a route or card.

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

CV approval additionally requires a `fits` layout assessment bound to the
current document fingerprint. A measurement from an older document can never
unlock approval for a newer candidate.

## Publication run

The publication Workflow accepts an approved CV entry, publishes its link,
starts PDF generation, polls with an Effect `Schedule`, and verifies the exact
revision, publication version, link, artifact, and renderer version. PDF-start
failure runs a compensating link-disable activity. Completion and compensation
invalidate the typed publication query.

Publication execution is also memory-backed. Registry links and ready artifacts
remain authoritative and survive browser runtime loss.

## Where to change code

- Add or change registry I/O in `data/repository/`, then expose it through a
  query or mutation atom.
- Change the shared `not_started` → `preparing` invariant in
  `application-lifecycle.ts`; both page bootstrap and Workflow startup use it.
- Change generation orchestration in `workflow/workflow.ts`; change external
  adapters in `workflow/gateway/`.
- Change run transitions atomically in `workflow/progress.ts`.
- Change editor policy in `editor/session.ts` and local mutations in
  `editor/atoms.ts`.
- Keep route `render.tsx` files declarative; put commands and cohesive UI cards
  in adjacent modules.

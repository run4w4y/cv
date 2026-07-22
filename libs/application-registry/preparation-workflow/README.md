# Application preparation workflow

Pure Effect implementation of CV and cover-letter preparation. The package owns
the workflow contracts, cover-letter document contract, generation prompts and
validation, progress state machine, human-review binding, and command
coordination.

The public runtime API is `ApplicationPreparation`:

- `start(input)` and `startBatch(input)` launch preparation runs. Every result
  includes a `batchId`; single starts receive their own batch and every run from
  one batch start shares the same identity.
- `submitReview({ runId, decision })` resolves the run's private review token.
- `cancel(runId)` resolves the run's private execution identity and interrupts
  it safely.
- `runs` is the public `SubscriptionRef` projection. It includes stable batch
  order, creation/update timestamps, and append-only step history while
  deliberately omitting Workflow execution IDs and durable-deferred tokens.

The `/domain` entrypoint exports pure selectors for deriving ordered batch
summaries and CI-style step timelines from that run projection. Execution state
remains memory-backed; these read models do not imply cross-session durability.

The host provides `PreparationStore`, `StructuredGeneration`, `Crypto`, and a
`WorkflowEngine`. The browser application currently selects
`WorkflowEngine.layerMemory`; that choice is not embedded in this package.

The package has no React, Effect Atom, browser-client, or cache-invalidation
dependency. Tests live beside their implementations and exercise the in-memory
Workflow engine directly.

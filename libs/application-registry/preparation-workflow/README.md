# Application preparation workflow

Pure Effect implementation of CV and cover-letter preparation. The package owns
the workflow contracts, cover-letter document contract, generation prompts and
validation, progress state machine, human-review binding, and command
coordination.

The public runtime API is `ApplicationPreparation`:

- `start(input)` and `startBatch(input)` launch preparation runs.
- `submitReview({ runId, decision })` resolves the run's private review token.
- `cancel(runId)` resolves the run's private execution identity and interrupts
  it safely.
- `runs` is the public `SubscriptionRef` projection. It deliberately omits
  Workflow execution IDs and durable-deferred tokens.

The host provides `PreparationStore`, `AiProvider`, `Crypto`, and a
`WorkflowEngine`. The browser application currently selects
`WorkflowEngine.layerMemory`; that choice is not embedded in this package.

The package has no React, Effect Atom, browser-client, or cache-invalidation
dependency. Tests live beside their implementations and exercise the in-memory
Workflow engine directly.

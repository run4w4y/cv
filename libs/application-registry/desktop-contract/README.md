# `@cv/application-registry-desktop-contract`

Runtime-validated IPC contracts shared by the Application Registry renderer
and its Electron host. The contract covers local Codex generation,
thread-aware document-assistant turns, host-backed network requests, and
stored registry connection settings.

Document-assistant turns use ordered tuple-path patches. Omitting `threadId`
starts a persisted Codex conversation; subsequent turns resume it by returning
the same ID. Every request and result carries both an operation ID and a
document checkpoint ID so cancellation and stale-draft rejection remain
explicit at the renderer boundary.

The package contains no Electron, Codex SDK, workflow, or browser
implementation. Electron owns the capabilities, while the renderer adapts
them to its application services.

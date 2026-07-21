# `@cv/application-registry-desktop-contract`

Runtime-validated IPC contracts shared by the Application Registry renderer
and its Electron host. The contract covers local Codex generation, host-backed
network requests, and stored registry connection settings.

The package contains no Electron, Codex SDK, workflow, or browser
implementation. Electron owns the capabilities, while the renderer adapts
them to its application services.

# Application registry desktop

Electron host for the shared registry management UI. The self-hosted web app
and this app use the same React source; desktop mode switches to hash routing and a
narrow preload bridge.

The main process owns two capabilities that are deliberately absent from the
web build:

- authenticated calls to the deployed `/machine/api/registry/*` transport;
- one-shot, schema-constrained generation through the official
  `@openai/codex-sdk` package and a matching packaged Codex executable.

The registry bearer token crosses the narrow preload bridge only when entered,
is checked against the API's authenticated machine health endpoint, and is
only then stored with Electron `safeStorage`. The API reads reviewed facts from
private MinIO; no object-store credential is shipped to either renderer.

## Build and run

From the repository's zsh/direnv shell:

```sh
bunx nx run application-registry-desktop:build
bunx nx run application-registry-desktop:start
```

`REGISTRY_API_URL` and `REGISTRY_API_TOKEN` are used automatically when the app
inherits them. A packaged app instead displays a first-run form and stores the
values locally.

The Registry control at the top of the application sidebar shows the active
origin and opens the connection settings. Locally stored connections can change
their origin and optionally replace the encrypted token. The desktop main
process verifies proposed credentials against authenticated `/machine/health`
before saving them, then reloads the renderer so cached data from different
registries cannot be mixed. Environment-provided connections are shown as
read-only; update both variables and restart the app to change them.

Development builds let the SDK resolve the executable installed by its package.
Packaged Windows builds always include the exact Codex version expected by the
SDK. A development-only override remains available for diagnostics:

```sh
CV_CODEX_EXECUTABLE=/absolute/path/to/codex
```

Create an unpacked Windows distribution with:

```sh
bunx nx run application-registry-desktop:package:windows
```

When developing from WSL, build that Win32 distribution and launch it as a
native Windows application with:

```sh
bunx nx run application-registry-desktop:start:windows:wsl
```

The launcher stages the unpacked application in
`%LOCALAPPDATA%\CV-Registry-Development` before starting it; Electron cannot be
run reliably from the `\\wsl.localhost` filesystem. The UI, credential storage,
Electron runtime, and Codex process are all native Windows. Codex state is read
from the normal `%USERPROFILE%\.codex` directory, so the desktop app uses the
account and model configuration already owned by the native Codex installation.
It does not implement another sign-in or model-discovery flow. Because Windows
does not inherit the WSL direnv environment, the first application launch still
asks for the deployed registry API origin and machine token.

Each generation starts a new SDK thread and does not resume it. The Codex SDK
may keep its normal local session record under `%USERPROFILE%\.codex`; the
registry backend never receives or stores an AI conversation.

Signing and an installer are intentionally separate release concerns.

# @cv/content-astro

Astro integration for the workspace content pipeline.

The integration wires an app-owned `ContentContract` into Astro and Vite. It
discovers authored content from `CONTENT_ROOT`, generates virtual modules for
the app, serves generated files during dev, and writes static content artifacts
during build.

## Usage

```ts
import { contentIntegration } from '@cv/content-astro'
import { cvContentContract } from './src/cv-content/contract'

export default defineConfig({
  integrations: [
    contentIntegration({
      contentBuildConfig,
      contract: cvContentContract,
      privateSecrets,
    }),
  ],
})
```

The integration provides:

- `virtual:content`, mapped to the app-owned authoring module;
- generated runtime modules consumed by app routes and renderers;
- a Vite alias for `#content-source`, pointing at the external content root;
- dev serving for generated `/files/...` and `/_content/files/...` assets.

Registry generation eagerly imports only the root `content.config` module, the
repository-configured `<contentDir>/variables` module, and authoring modules below
`<contentDir>/profiles`. Downloadable `files`/`_files` content, declarations,
tests, and hidden/build directories are never evaluated as source modules.
Content edits rebuild artifacts and trigger a full development-page reload.

For consumers that need authored context rather than a composed application
document, `@cv/content-astro/source` opens a repository directly from
`content.config.ts`. It discovers source files without evaluating profile
modules or MDX and returns raw shared, default-profile, and selected-profile
layers with paths and provenance. This API does not require an app
`ContentContract` or generate an interchange artifact.

## Boundary

This package provides Astro/Vite integration and generic repository loading. It
does not define the CV content schema or UI. Those live in `apps/cv`.

## Verification

```bash
bunx nx run content-astro:typecheck
bunx nx run content-astro:test:unit
```

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

## Boundary

This package is Astro/Vite glue. It does not define the CV content schema or UI.
Those live in `apps/cv`.

## Verification

```bash
bunx nx run content-astro:typecheck
bunx nx run content-astro:test:unit
```

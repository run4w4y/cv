# @cv/content-composer

Generic composition utilities for turning repository modules into content
manifests.

This package discovers content modules, normalizes registry keys, resolves
profile inheritance, merges plain content values, and calls an app-owned
`ContentContract` to build the final manifest.

## What It Knows

- A content repository has a root `content.config.ts`.
- Profile content lives below
  `<contentDir>/profiles/<profile>/<locale>/<section>`, where `contentDir`
  is configured by the repository.
- `.ts`, `.tsx`, `.js`, `.jsx`, and `.mdx` files can be content sections.
- Non-default profiles can inherit sections from the default profile.

## What The App Owns

The repository config owns source layout, locales, and default profile. The app
decides what each section means. `@cv/content-composer` can discover an
`experience/acme.mdx` section, but it does not know whether that is a job,
project, article, or something else. The app-owned `ContentContract` supplies
the runtime schema and version, final composition logic, and authoring module.
The composer stamps the generic
`content-manifest.v1` envelope, validates every final value with the app schema,
and rejects values that cannot cross the JSON boundary.

## Typical Use

```ts
import { composeContent } from '@cv/content-composer'
import { cvContentContract } from '@cv/cv/content-contract'

const result = composeContent(registry, cvContentContract)
```

Astro apps usually call this through `@cv/content-astro` rather than directly.

## Verification

```bash
bunx nx run content-composer:typecheck
bunx nx run content-composer:test:unit
```

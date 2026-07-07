# @cv/content-core

Public content contracts and schemas for the content workspace.

This package intentionally contains no authored content copy, filesystem-backed
content compiler, React helpers, or private-runtime encryption code.

## Responsibilities

- expose Effect Schema decoders for public content manifests
- expose schema-derived shared runtime types for public content
- expose variable reference/value helpers shared by public and private content
- expose generic content overlay and file-index vocabulary used across build and
  runtime packages

```sh
bunx nx run content-core:typecheck --skip-nx-cache
```

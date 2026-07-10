# @cv/content-types

Generator for portable content-authoring TypeScript declarations.

Authored content can live outside this workspace, but it still imports app-owned
helpers from `virtual:content`. This tool reads an app-owned content schema
registry and authoring component module, then writes a standalone
`content-authoring.d.ts` file for the content repository.

## Usage

The workspace target is wired to the CV app contract:

```bash
bunx nx run content-types:generate
```

By default it reads:

- `apps/cv/src/cv-content/schema/registry.ts`
- `apps/cv/src/cv-content/authoring/components.tsx`

and writes to:

```text
${CONTENT_ROOT:-../cv-content}/types/content-authoring.d.ts
```

For another app contract, call the generator directly:

```bash
bun run tools/content-types/src/generate.ts \
  --source apps/cv/src/cv-content/schema/registry.ts \
  --authoring apps/cv/src/cv-content/authoring/components.tsx \
  --out /path/to/content-repo/types/content-authoring.d.ts
```

Flags:

- `--source <path>`: module exporting the content schema registry.
- `--authoring <path>`: module exporting authoring components.
- `--out <path>`: output declaration file. If omitted, declarations are printed
  to stdout.

Use this after changing app-owned schemas or `virtual:content` authoring
components so the external content repository sees accurate types.

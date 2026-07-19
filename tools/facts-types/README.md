# Facts authoring type generator

Generates the portable `virtual:facts` declaration consumed by the neighboring
facts repository. The authoring schemas and declaration renderer remain owned
by `cv`; `cv-content` receives only a checked-in `.d.ts` file.

```sh
bunx nx run facts-types:generate
```

Set `CONTENT_ROOT` or pass `--out <path>` to select another checkout.

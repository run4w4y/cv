# Handlebars CSS Template

Typed Vite loader and runtime helpers for importing `.css.hbs` files as CSS
template renderers.

The loader precompiles Handlebars templates at build time and emits a tiny
JavaScript module that delegates all runtime behavior to
`@cv/handlebars-css-template/runtime`. This keeps the generated code
small while preserving normal TypeScript, lint, and unit-test coverage for the
actual escaping and rendering logic.

## Usage

Register the plugin from an Astro or Vite config:

```ts
import { handlebarsCssTemplatePlugin } from '@cv/handlebars-css-template/plugin'

export default {
  vite: {
    plugins: [handlebarsCssTemplatePlugin()],
  },
}
```

Import a template and render it with a plain object:

```ts
import pageStyleTemplate from './page-style.css.hbs'

const css = pageStyleTemplate({
  title: 'Private Content',
})
```

Inside `.css.hbs` files, interpolate dynamic CSS string values with the
`cssString` helper:

```css
@page {
  @top-center {
    content: {{cssString title}};
  }
}
```

`cssString` wraps and escapes values with `cssesc`, so callers pass raw values
instead of pre-escaped CSS fragments.

## Verification

```sh
bunx nx run handlebars-css-template:typecheck --skip-nx-cache
bunx nx run handlebars-css-template:test:unit --skip-nx-cache
bunx nx run handlebars-css-template:lint --skip-nx-cache
```

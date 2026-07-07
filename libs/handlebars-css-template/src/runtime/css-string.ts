/// <reference path="../vendor/cssesc.d.ts" />

import type { CssescOptions } from 'cssesc'
import cssesc from 'cssesc'
import Handlebars from 'handlebars/runtime'

const cssStringOptions = {
  escapeEverything: true,
  quotes: 'double',
  wrap: true,
} satisfies CssescOptions

export const escapeCssString = (value: unknown): string =>
  cssesc(String(value ?? ''), cssStringOptions)

export const cssString = (value: unknown): Handlebars.SafeString =>
  new Handlebars.SafeString(escapeCssString(value))

import { describe, expect, test } from 'bun:test'
import * as Handlebars from 'handlebars'

import { type CssTemplateSpec, renderCssTemplate } from './render-css-template'

const precompileCssTemplate = (source: string): CssTemplateSpec =>
  globalThis.eval(
    `(${String(
      Handlebars.precompile(source, {
        strict: true,
      })
    )})`
  ) as CssTemplateSpec

describe('CSS template rendering', () => {
  test('renders precompiled templates with the cssString helper', () => {
    const templateSpec = precompileCssTemplate(
      'body { content: {{cssString value}}; }'
    )

    expect(renderCssTemplate(templateSpec, { value: 'A"B' })).toBe(
      'body { content: "\\41\\"\\42"; }'
    )
  })

  test('keeps Handlebars strict mode behavior for missing values', () => {
    const templateSpec = precompileCssTemplate('body { color: {{value}}; }')

    expect(() => renderCssTemplate(templateSpec, {})).toThrow(
      '"value" not defined'
    )
  })
})

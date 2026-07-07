import { describe, expect, test } from 'bun:test'

import { handlebarsCssTemplatePlugin } from './handlebars-css-template-plugin'

describe('Handlebars CSS template Vite plugin', () => {
  test('creates a pre-enforced Vite plugin that exposes a load hook', () => {
    const plugin = handlebarsCssTemplatePlugin()

    expect(plugin.name).toBe('handlebars-css-template')
    expect(plugin.enforce).toBe('pre')
    expect(plugin.load).toBeFunction()
  })
})

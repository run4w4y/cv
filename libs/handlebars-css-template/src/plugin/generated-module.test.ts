import { describe, expect, test } from 'bun:test'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

import * as Handlebars from 'handlebars'

import { createCssTemplateModuleSource } from './generated-module'

const runtimeImport = new URL('../runtime/index.ts', import.meta.url).href

const precompile = (source: string): string =>
  String(
    Handlebars.precompile(source, {
      strict: true,
    })
  )

describe('generated CSS template modules', () => {
  test('generate a tiny module that delegates rendering to the typed runtime', () => {
    const source = createCssTemplateModuleSource({
      runtimeImport,
      templateSpec: precompile('body { content: {{cssString value}}; }'),
    })

    expect(source).toContain(
      `import { renderCssTemplate } from ${JSON.stringify(runtimeImport)}`
    )
    expect(source).toContain('export default renderTemplate')
    expect(source).not.toContain('cssesc')
    expect(source).not.toContain('Handlebars.SafeString')
  })

  test('generated modules can be imported and rendered by Bun', async () => {
    const tempDirectory = await mkdtemp(
      join(tmpdir(), 'handlebars-css-template-')
    )
    const modulePath = join(tempDirectory, 'template.mjs')
    const source = createCssTemplateModuleSource({
      runtimeImport,
      templateSpec: precompile('body { content: {{cssString value}}; }'),
    })

    try {
      await writeFile(modulePath, source)

      const module = (await import(
        `${pathToFileURL(modulePath).href}?test=${Date.now()}`
      )) as {
        default: (context: Record<string, unknown>) => string
      }

      expect(module.default({ value: 'A"B' })).toBe(
        'body { content: "\\41\\"\\42"; }'
      )
    } finally {
      await rm(tempDirectory, {
        force: true,
        recursive: true,
      })
    }
  })
})

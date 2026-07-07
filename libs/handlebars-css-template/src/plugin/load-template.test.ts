import { describe, expect, test } from 'bun:test'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

import {
  defaultTemplateExtension,
  loadCssTemplateModule,
  resolveCssTemplateLoaderOptions,
  stripQuery,
} from './load-template'

const runtimeImport = new URL('../runtime/index.ts', import.meta.url).href

describe('CSS template loading', () => {
  test('strips Vite query suffixes before file matching and reading', () => {
    expect(stripQuery('/tmp/page-style.css.hbs?used')).toBe(
      '/tmp/page-style.css.hbs'
    )
  })

  test('resolves defaults while allowing runtime imports to be overridden', () => {
    expect(
      resolveCssTemplateLoaderOptions({
        runtimeImport,
      })
    ).toEqual({
      extension: defaultTemplateExtension,
      runtimeImport,
    })
  })

  test('loads matching template files into importable modules', async () => {
    const tempDirectory = await mkdtemp(
      join(tmpdir(), 'handlebars-css-template-')
    )
    const templatePath = join(tempDirectory, 'style.css.hbs')
    const modulePath = join(tempDirectory, 'style.mjs')

    try {
      await writeFile(templatePath, 'body { content: {{cssString value}}; }')

      const source = await loadCssTemplateModule(`${templatePath}?direct`, {
        extension: defaultTemplateExtension,
        runtimeImport,
      })

      expect(source).toBeString()
      await writeFile(modulePath, source ?? '')

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

  test('ignores files outside of the configured extension', async () => {
    expect(
      await loadCssTemplateModule('/tmp/style.css', {
        extension: defaultTemplateExtension,
        runtimeImport,
      })
    ).toBeNull()
  })
})

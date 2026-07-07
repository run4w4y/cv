import { describe, expect, test } from 'bun:test'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { runEffectPromise } from './node-runtime'
import { renderRegistryModuleTemplate } from './templates'

const writeSourceFile = (path: string, source = 'export default {}') => {
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, source)
}

const viteFsPath = (path: string) => `/@fs${path.replaceAll('\\', '/')}`

describe('content registry template', () => {
  test('keeps generated imports inside the content source boundary', async () => {
    const contentRoot = mkdtempSync(join(tmpdir(), 'cv-content-registry-'))

    try {
      writeSourceFile(join(contentRoot, 'content.config.ts'))
      writeSourceFile(join(contentRoot, 'variables.ts'))
      writeSourceFile(join(contentRoot, 'content', 'variables.ts'))
      writeSourceFile(
        join(contentRoot, 'content', 'profiles', 'default', 'en', 'profile.ts')
      )
      writeSourceFile(
        join(
          contentRoot,
          'node_modules',
          '@babel',
          'code-frame',
          'lib',
          'index.js'
        ),
        'Object.defineProperty(exports, "__esModule", { value: true })'
      )

      const source = await runEffectPromise(
        renderRegistryModuleTemplate({ contentRoot })
      )

      expect(source).toContain(
        viteFsPath(join(contentRoot, 'content.config.ts'))
      )
      expect(source).toContain(
        viteFsPath(join(contentRoot, 'content', 'variables.ts'))
      )
      expect(source).toContain(
        viteFsPath(
          join(
            contentRoot,
            'content',
            'profiles',
            'default',
            'en',
            'profile.ts'
          )
        )
      )
      expect(source).not.toContain(
        viteFsPath(join(contentRoot, 'variables.ts'))
      )
      expect(source).not.toContain('node_modules')
    } finally {
      rmSync(contentRoot, { force: true, recursive: true })
    }
  })
})

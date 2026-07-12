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
          'content',
          'profiles',
          'default',
          'en',
          'experience',
          'acme.mdx'
        )
      )
      writeSourceFile(
        join(
          contentRoot,
          'content',
          'profiles',
          'default',
          'en',
          'about.test.ts'
        )
      )
      writeSourceFile(
        join(
          contentRoot,
          'content',
          'profiles',
          'default',
          '_files',
          'private.js'
        )
      )
      writeSourceFile(
        join(
          contentRoot,
          'content',
          'profiles',
          'default',
          'en',
          'deps',
          'dependency.ts'
        )
      )
      writeSourceFile(
        join(
          contentRoot,
          'content',
          'profiles',
          'default',
          'en',
          'files',
          'attachment.ts'
        )
      )
      writeSourceFile(
        join(contentRoot, 'content', 'files', 'public', 'download.js')
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
        renderRegistryModuleTemplate({ contentDir: 'content', contentRoot })
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
      expect(source).toContain(
        viteFsPath(
          join(
            contentRoot,
            'content',
            'profiles',
            'default',
            'en',
            'experience',
            'acme.mdx'
          )
        )
      )
      expect(source).not.toContain('about.test.ts')
      expect(source).not.toContain('_files')
      expect(source).not.toContain('dependency.ts')
      expect(source).not.toContain('attachment.ts')
      expect(source).not.toContain('download.js')
      expect(source).not.toContain('node_modules')
    } finally {
      rmSync(contentRoot, { force: true, recursive: true })
    }
  })

  test('uses an app-owned custom content directory', async () => {
    const contentRoot = mkdtempSync(join(tmpdir(), 'cv-content-registry-'))

    try {
      writeSourceFile(join(contentRoot, 'content.config.ts'))
      writeSourceFile(join(contentRoot, 'resume-data', 'variables.ts'))
      writeSourceFile(
        join(
          contentRoot,
          'resume-data',
          'profiles',
          'default',
          'en',
          'profile.ts'
        )
      )
      writeSourceFile(
        join(contentRoot, 'content', 'profiles', 'default', 'en', 'ignored.ts')
      )

      const source = await runEffectPromise(
        renderRegistryModuleTemplate({
          contentDir: 'resume-data',
          contentRoot,
        })
      )

      expect(source).toContain('resume-data/variables.ts')
      expect(source).toContain('resume-data/profiles/default/en/profile.ts')
      expect(source).not.toContain('content/profiles/default/en/ignored.ts')
    } finally {
      rmSync(contentRoot, { force: true, recursive: true })
    }
  })
})

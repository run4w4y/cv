import { describe, expect, test } from 'bun:test'
import {
  mkdirSync,
  mkdtempSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import {
  loadContentRepositoryConfig,
  openContentSourceRepository,
} from './source-repository'

const writeSourceFile = (path: string, source: string) => {
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, source)
}

const sourcePaths = (sources: readonly { modulePath: string }[]) =>
  sources.map((source) => source.modulePath)

describe('authored content source repository', () => {
  test('loads inert shared, base, and target sources from a generic repository', async () => {
    const contentRoot = mkdtempSync(join(tmpdir(), 'authored-content-'))
    const outsideRoot = mkdtempSync(join(tmpdir(), 'authored-content-outside-'))

    try {
      const inertMdxSource = `export const mustStayRaw = (() => {
        throw new Error('MDX sources must not be evaluated')
      })()

# Backend overlay`

      writeSourceFile(
        join(contentRoot, 'content.config.ts'),
        `export default {
          contentDir: 'authored',
          defaultLocale: 'fr',
          defaultProfile: 'foundation',
          locales: ['fr', 'de'],
          publicProfiles: ['foundation'],
        }`
      )
      writeSourceFile(
        join(contentRoot, 'authored', 'variables.ts'),
        `export const variables = { location: 'Remote' }`
      )
      writeSourceFile(
        join(contentRoot, 'authored', 'shared', 'taxonomy.ts'),
        `export const taxonomy = ['systems', 'delivery']`
      )
      writeSourceFile(
        join(contentRoot, 'authored', 'shared', 'context.mdx'),
        '# Shared authoring context'
      )
      writeSourceFile(
        join(
          contentRoot,
          'authored',
          'profiles',
          'foundation',
          'fr',
          'about.mdx'
        ),
        '# Foundation profile'
      )
      writeSourceFile(
        join(
          contentRoot,
          'authored',
          'profiles',
          'foundation',
          'fr',
          'experience',
          'index.ts'
        ),
        `throw new Error('profile modules must not be evaluated')`
      )
      writeSourceFile(
        join(
          contentRoot,
          'authored',
          'profiles',
          'foundation',
          'de',
          'about.mdx'
        ),
        '# Grundlage'
      )
      writeSourceFile(
        join(contentRoot, 'authored', 'profiles', 'backend', 'fr', 'about.mdx'),
        inertMdxSource
      )
      writeSourceFile(
        join(
          contentRoot,
          'authored',
          'profiles',
          'backend',
          'fr',
          'systems',
          'runtime.tsx'
        ),
        `export default { evidence: 'runtime ownership' }`
      )

      for (const ignoredPath of [
        ['authored', '.draft', 'secret.ts'],
        ['authored', '.secret.ts'],
        ['authored', '_files', 'generated.ts'],
        ['authored', 'deps', 'dependency.ts'],
        ['authored', 'dist', 'compiled.js'],
        ['authored', 'files', 'attachment.ts'],
        ['authored', 'node_modules', 'package', 'index.js'],
        ['authored', 'profiles', 'backend', 'fr', 'about.test.ts'],
        ['authored', 'profiles', 'backend', 'fr', 'generated.d.ts'],
      ]) {
        writeSourceFile(
          join(contentRoot, ...ignoredPath),
          `throw new Error('ignored source must not be read')`
        )
      }

      writeSourceFile(
        join(outsideRoot, 'leak.ts'),
        'export const leaked = true'
      )
      writeSourceFile(
        join(outsideRoot, 'linked-profile', 'fr', 'leak.ts'),
        'export const leaked = true'
      )
      symlinkSync(
        join(outsideRoot, 'leak.ts'),
        join(contentRoot, 'authored', 'shared', 'linked.ts')
      )
      symlinkSync(
        join(outsideRoot, 'linked-profile'),
        join(contentRoot, 'authored', 'profiles', 'linked')
      )

      const repository = await openContentSourceRepository({ contentRoot })

      expect(repository.config).toEqual({
        contentDir: 'authored',
        defaultLocale: 'fr',
        defaultProfile: 'foundation',
        locales: ['fr', 'de'],
        publicProfiles: ['foundation'],
      })
      expect(repository.profiles).toEqual(['backend', 'foundation'])
      expect(repository.availableProfiles).toEqual({
        de: ['foundation'],
        fr: ['backend', 'foundation'],
      })

      const profile = await repository.loadProfileSources({
        locale: 'fr',
        profile: 'backend',
      })

      expect(profile).toMatchObject({
        defaultProfile: 'foundation',
        locale: 'fr',
        profile: 'backend',
      })
      expect(profile.layers.map((layer) => layer.profile)).toEqual([
        'foundation',
        'backend',
      ])
      expect(profile.layers.map((layer) => layer.locale)).toEqual(['fr', 'fr'])
      expect(sourcePaths(profile.layers[0]?.sources ?? [])).toEqual([
        'authored/profiles/foundation/fr/about.mdx',
        'authored/profiles/foundation/fr/experience/index.ts',
      ])
      expect(sourcePaths(profile.layers[1]?.sources ?? [])).toEqual([
        'authored/profiles/backend/fr/about.mdx',
        'authored/profiles/backend/fr/systems/runtime.tsx',
      ])
      expect(profile.layers[0]?.sources[1]).toEqual({
        kind: 'module',
        locale: 'fr',
        modulePath: 'authored/profiles/foundation/fr/experience/index.ts',
        path: ['experience'],
        profile: 'foundation',
        source: `throw new Error('profile modules must not be evaluated')`,
        sourceProfile: 'foundation',
      })
      expect(profile.layers[1]?.sources[0]).toMatchObject({
        kind: 'mdx',
        path: ['about'],
        profile: 'backend',
        source: inertMdxSource,
        sourceProfile: 'backend',
      })
      expect(profile.sharedSources).toEqual([
        {
          kind: 'mdx',
          modulePath: 'authored/shared/context.mdx',
          source: '# Shared authoring context',
        },
        {
          kind: 'module',
          modulePath: 'authored/shared/taxonomy.ts',
          source: `export const taxonomy = ['systems', 'delivery']`,
        },
        {
          kind: 'module',
          modulePath: 'authored/variables.ts',
          source: `export const variables = { location: 'Remote' }`,
        },
      ])

      await expect(
        repository.loadProfileSources({ locale: 'en', profile: 'backend' })
      ).rejects.toThrow('Unknown content locale "en"')
      await expect(
        repository.loadProfileSources({ locale: 'de', profile: 'backend' })
      ).rejects.toThrow('No authored content is available for de/backend')
    } finally {
      rmSync(contentRoot, { force: true, recursive: true })
      rmSync(outsideRoot, { force: true, recursive: true })
    }
  })

  test('loads validated repository config without requiring profile sources', async () => {
    const contentRoot = mkdtempSync(join(tmpdir(), 'authored-content-'))

    try {
      writeSourceFile(
        join(contentRoot, 'content.config.ts'),
        `export default {
          contentDir: 'source',
          defaultLocale: 'es',
          defaultProfile: 'base',
          locales: ['es'],
        }`
      )

      await expect(
        loadContentRepositoryConfig({ contentRoot })
      ).resolves.toEqual({
        contentDir: 'source',
        defaultLocale: 'es',
        defaultProfile: 'base',
        locales: ['es'],
        publicProfiles: ['base'],
      })
    } finally {
      rmSync(contentRoot, { force: true, recursive: true })
    }
  })

  test('requires repository-owned layout and defaults', async () => {
    const contentRoot = mkdtempSync(join(tmpdir(), 'authored-content-'))

    try {
      writeSourceFile(
        join(contentRoot, 'content.config.ts'),
        `export default { locales: ['en'] }`
      )

      await expect(
        loadContentRepositoryConfig({ contentRoot })
      ).rejects.toThrow(
        'Content repository config must define a non-empty contentDir.'
      )
    } finally {
      rmSync(contentRoot, { force: true, recursive: true })
    }
  })
})

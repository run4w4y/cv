import { describe, expect, test } from 'bun:test'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { Effect } from 'effect'
import { makeRepositoryCampaignProfileSource } from './profile-source'

const writeSource = async (root: string, path: string, source: string) => {
  const file = join(root, path)
  await mkdir(dirname(file), { recursive: true })
  await writeFile(file, source)
}

describe('repository campaign profile source', () => {
  test('loads arbitrary authored source layers without knowing their schema', async () => {
    const contentRoot = await mkdtemp(
      join(tmpdir(), 'campaign-source-repository-')
    )

    try {
      await Promise.all([
        writeSource(
          contentRoot,
          'content.config.ts',
          `export default {
            contentDir: 'knowledge',
            defaultLocale: 'zz',
            defaultProfile: 'foundation',
            locales: ['zz', 'yy'],
          }`
        ),
        writeSource(
          contentRoot,
          'knowledge/shared/glossary.ts',
          `export default { arbitrarySharedTerm: 'quasar' }`
        ),
        writeSource(
          contentRoot,
          'knowledge/variables.ts',
          `export default { unrelatedVariable: 42 }`
        ),
        writeSource(
          contentRoot,
          'knowledge/profiles/foundation/zz/manifesto.mdx',
          '# Foundation\n\nCompletely arbitrary prose.'
        ),
        writeSource(
          contentRoot,
          'knowledge/profiles/foundation/zz/oddities/nebula.ts',
          `export default { madeUpShape: ['alpha', 'beta'] }`
        ),
        writeSource(
          contentRoot,
          'knowledge/profiles/specialist/zz/delta.ts',
          `export default { overlay: 'specialist-only' }`
        ),
      ])

      const source = makeRepositoryCampaignProfileSource()
      const collection = await Effect.runPromise(source.open({ contentRoot }))
      const catalog = await Effect.runPromise(
        collection.load({ locale: 'zz', profiles: ['specialist'] })
      )
      const profile = catalog.content.zz?.specialist as {
        layers: readonly {
          profile: string
          sources: readonly {
            modulePath: string
            path: readonly string[]
            source: string
          }[]
        }[]
        sharedSources: readonly { modulePath: string; source: string }[]
      }

      expect(collection).toMatchObject({
        availableProfiles: {
          yy: [],
          zz: ['foundation', 'specialist'],
        },
        defaultLocale: 'zz',
        defaultProfile: 'foundation',
        locales: ['zz', 'yy'],
        profiles: ['foundation', 'specialist'],
      })
      expect(profile.layers.map((layer) => layer.profile)).toEqual([
        'foundation',
        'specialist',
      ])
      expect(
        profile.layers.flatMap((layer) =>
          layer.sources.map((entry) => ({
            modulePath: entry.modulePath,
            path: entry.path,
            source: entry.source,
          }))
        )
      ).toEqual([
        {
          modulePath: 'knowledge/profiles/foundation/zz/manifesto.mdx',
          path: ['manifesto'],
          source: '# Foundation\n\nCompletely arbitrary prose.',
        },
        {
          modulePath: 'knowledge/profiles/foundation/zz/oddities/nebula.ts',
          path: ['oddities', 'nebula'],
          source: `export default { madeUpShape: ['alpha', 'beta'] }`,
        },
        {
          modulePath: 'knowledge/profiles/specialist/zz/delta.ts',
          path: ['delta'],
          source: `export default { overlay: 'specialist-only' }`,
        },
      ])
      expect(profile.sharedSources.map((entry) => entry.modulePath)).toEqual([
        'knowledge/shared/glossary.ts',
        'knowledge/variables.ts',
      ])
      expect(catalog).not.toHaveProperty('descriptions')
    } finally {
      await rm(contentRoot, { force: true, recursive: true })
    }
  })

  test('reports a requested profile that has no authored content', async () => {
    const contentRoot = await mkdtemp(
      join(tmpdir(), 'campaign-source-repository-')
    )

    try {
      await Promise.all([
        writeSource(
          contentRoot,
          'content.config.ts',
          `export default {
            contentDir: 'knowledge',
            defaultLocale: 'zz',
            defaultProfile: 'foundation',
            locales: ['zz'],
          }`
        ),
        writeSource(
          contentRoot,
          'knowledge/profiles/foundation/zz/root.ts',
          `export default { anything: true }`
        ),
      ])

      const source = makeRepositoryCampaignProfileSource()
      const collection = await Effect.runPromise(source.open({ contentRoot }))

      await expect(
        Effect.runPromise(
          collection.load({ locale: 'zz', profiles: ['missing'] })
        )
      ).rejects.toThrow('No zz content is available for profile "missing".')
    } finally {
      await rm(contentRoot, { force: true, recursive: true })
    }
  })
})

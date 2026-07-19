import { describe, expect, test } from 'bun:test'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fixtureAssetBytes } from '@cv/facts-release/test-support'
import { Effect } from 'effect'

import { compileFactsCheckout } from './source'

const provenance = {
  compilerCommit: 'b'.repeat(40),
  compilerRepository: 'run4w4y/cv',
  sourceCommit: 'a'.repeat(40),
  sourceRepository: 'run4w4y/cv-content',
}

const configSource = `import type { FactsRepositoryConfig } from 'virtual:facts'

export default {
  defaultLocale: 'en',
  factsDir: 'facts',
  locales: ['en', 'ru'],
} satisfies FactsRepositoryConfig
`

const evidenceSource = `import type { FactEvidenceRegistry } from 'virtual:facts'

export default {
  'evidence.current-role-review': {
    kind: 'personal-review',
    title: 'Current role review',
  },
} satisfies FactEvidenceRegistry
`

const assetsSource = `import type { FactAssetRegistry } from 'virtual:facts'

export default {
  'asset.employment-review': {
    description: 'Reviewed supporting material for the employment claim.',
    fileName: 'employment-review.pdf',
    label: 'Employment review',
    mediaType: 'application/pdf',
  },
} satisfies FactAssetRegistry
`

const entrySource = (
  locale: 'en' | 'ru'
) => `import type { ExperienceEntry } from 'virtual:facts'

export default {
  company: 'Analytical Engines',
  companyVisibility: 'private',
  period: '2023 - Present',
  roles: ['Software Engineer'],
  overview: {
    evidenceIds: ['evidence.current-role-review'],
    text: '${
      locale === 'en'
        ? 'Works as a software engineer.'
        : 'Работает инженером-программистом.'
    }',
  },
  highlights: [],
  workstreams: [],
} satisfies ExperienceEntry
`

const sectionSource = `import type { ExperienceSection } from 'virtual:facts'
import currentRole from './current-role'

export default {
  kind: 'experience',
  entries: [currentRole],
} satisfies ExperienceSection
`

const withCheckout = async <A>(
  action: (root: string) => Promise<A>,
  options: {
    readonly extraAsset?: boolean
    readonly omitRussian?: boolean
  } = {}
) => {
  const root = await mkdtemp(join(tmpdir(), 'cv-facts-checkout-'))
  try {
    await mkdir(join(root, 'facts/assets'), { recursive: true })
    await mkdir(join(root, 'facts/en/employment'), { recursive: true })
    if (!options.omitRussian) {
      await mkdir(join(root, 'facts/ru/employment'), { recursive: true })
    }
    await Promise.all([
      writeFile(join(root, 'facts.config.ts'), configSource),
      writeFile(join(root, 'facts/evidence.ts'), evidenceSource),
      writeFile(join(root, 'facts/assets.ts'), assetsSource),
      writeFile(
        join(root, 'facts/en/employment/current-role.ts'),
        entrySource('en')
      ),
      writeFile(join(root, 'facts/en/employment/index.ts'), sectionSource),
      ...(!options.omitRussian
        ? [
            writeFile(
              join(root, 'facts/ru/employment/current-role.ts'),
              entrySource('ru')
            ),
            writeFile(
              join(root, 'facts/ru/employment/index.ts'),
              sectionSource
            ),
          ]
        : []),
      writeFile(
        join(root, 'facts/assets/employment-review.pdf'),
        fixtureAssetBytes
      ),
    ])
    if (options.extraAsset) {
      await writeFile(join(root, 'facts/assets/unreviewed.txt'), 'not reviewed')
    }
    return await action(root)
  } finally {
    await rm(root, { force: true, recursive: true })
  }
}

describe('facts source checkout', () => {
  test('loads sectioned TypeScript for every config-owned locale', async () => {
    await withCheckout(async (root) => {
      const release = await Effect.runPromise(
        compileFactsCheckout(root, provenance)
      )

      expect(release.manifest.provenance).toEqual({
        compiler: {
          commit: provenance.compilerCommit,
          repository: provenance.compilerRepository,
        },
        source: {
          commit: provenance.sourceCommit,
          repository: provenance.sourceRepository,
        },
      })
      expect(release.catalogues.map(({ locale }) => locale)).toEqual([
        'en',
        'ru',
      ])
      expect(release.releaseId).toBe(`fr_${release.manifestObject.sha256}`)
      const englishExperience = release.catalogues[0]?.sections.find(
        ({ kind }) => kind === 'experience'
      )
      expect(englishExperience?.kind).toBe('experience')
      if (englishExperience?.kind === 'experience') {
        expect(englishExperience.entries[0]?.id).toBe('experience.entries.0')
        expect(englishExperience.entries[0]?.overview?.id).toBe(
          'experience.entries.0.overview'
        )
      }
      expect(
        release.objects.find(({ kind }) => kind === 'asset')?.bytes
      ).toEqual(fixtureAssetBytes)
    })
  })

  test('rejects undeclared files in the reviewed asset directory', async () => {
    await withCheckout(
      async (root) => {
        const error = await Effect.runPromise(
          Effect.flip(compileFactsCheckout(root, provenance))
        )

        expect(error._tag).toBe('FactsPublisherSourceError')
        if (error._tag === 'FactsPublisherSourceError') {
          expect(error.operation).toBe('load-source')
          expect(String(error.cause)).toContain('Undeclared facts asset')
        }
      },
      { extraAsset: true }
    )
  })

  test('rejects a configured locale whose source tree is missing', async () => {
    await withCheckout(
      async (root) => {
        const error = await Effect.runPromise(
          Effect.flip(compileFactsCheckout(root, provenance))
        )

        expect(error._tag).toBe('FactsPublisherSourceError')
        if (error._tag === 'FactsPublisherSourceError') {
          expect(error.operation).toBe('load-source')
        }
      },
      { omitRussian: true }
    )
  })
})

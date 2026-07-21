import { describe, expect, test } from 'bun:test'
import type { CompiledFactsRelease } from '@cv/facts-release'
import {
  cvGenerationGuidanceFixture,
  fixtureAssetBytes,
} from '@cv/facts-release/test-support'
import { BunServices } from '@effect/platform-bun'
import { Effect } from 'effect'
import {
  FileSystem,
  type FileSystem as FileSystemService,
} from 'effect/FileSystem'
import { Path, type Path as PathService } from 'effect/Path'

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
  generationGuidance: 'generation/cv.ts',
  locales: ['en', 'ru'],
} satisfies FactsRepositoryConfig
`

const generationGuidanceSource = `export default ${JSON.stringify(
  cvGenerationGuidanceFixture
)}`

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

const withCheckout = <A, E, R>(
  action: (root: string) => Effect.Effect<A, E, R>,
  options: {
    readonly assetSymlinkEscape?: boolean
    readonly extraAsset?: boolean
    readonly omitRussian?: boolean
  } = {}
) =>
  Effect.scoped(
    Effect.gen(function* () {
      const fileSystem = yield* FileSystem
      const path = yield* Path
      const root = yield* fileSystem.makeTempDirectoryScoped({
        prefix: 'cv-facts-checkout-',
      })
      yield* fileSystem.makeDirectory(path.join(root, 'facts/assets'), {
        recursive: true,
      })
      yield* fileSystem.makeDirectory(path.join(root, 'generation'), {
        recursive: true,
      })
      yield* fileSystem.makeDirectory(path.join(root, 'facts/en/employment'), {
        recursive: true,
      })
      if (!options.omitRussian) {
        yield* fileSystem.makeDirectory(
          path.join(root, 'facts/ru/employment'),
          { recursive: true }
        )
      }
      yield* Effect.all(
        [
          fileSystem.writeFileString(
            path.join(root, 'facts.config.ts'),
            configSource
          ),
          fileSystem.writeFileString(
            path.join(root, 'generation/cv.ts'),
            generationGuidanceSource
          ),
          fileSystem.writeFileString(
            path.join(root, 'facts/evidence.ts'),
            evidenceSource
          ),
          fileSystem.writeFileString(
            path.join(root, 'facts/assets.ts'),
            assetsSource
          ),
          fileSystem.writeFileString(
            path.join(root, 'facts/en/employment/current-role.ts'),
            entrySource('en')
          ),
          fileSystem.writeFileString(
            path.join(root, 'facts/en/employment/index.ts'),
            sectionSource
          ),
          ...(!options.omitRussian
            ? [
                fileSystem.writeFileString(
                  path.join(root, 'facts/ru/employment/current-role.ts'),
                  entrySource('ru')
                ),
                fileSystem.writeFileString(
                  path.join(root, 'facts/ru/employment/index.ts'),
                  sectionSource
                ),
              ]
            : []),
          fileSystem.writeFile(
            path.join(root, 'facts/assets/employment-review.pdf'),
            fixtureAssetBytes
          ),
        ],
        { concurrency: 'unbounded' }
      )
      if (options.extraAsset) {
        yield* fileSystem.writeFileString(
          path.join(root, 'facts/assets/unreviewed.txt'),
          'not reviewed'
        )
      }
      if (options.assetSymlinkEscape) {
        const externalRoot = yield* fileSystem.makeTempDirectoryScoped({
          prefix: 'cv-facts-external-',
        })
        const externalAsset = path.join(externalRoot, 'employment-review.pdf')
        const checkoutAsset = path.join(
          root,
          'facts/assets/employment-review.pdf'
        )
        yield* fileSystem.writeFile(externalAsset, fixtureAssetBytes)
        yield* fileSystem.remove(checkoutAsset)
        yield* fileSystem.symlink(externalAsset, checkoutAsset)
      }
      return yield* action(root)
    })
  )

const runWithCheckout = <A, E>(
  action: (
    root: string
  ) => Effect.Effect<A, E, FileSystemService | PathService>,
  options?: {
    readonly assetSymlinkEscape?: boolean
    readonly extraAsset?: boolean
    readonly omitRussian?: boolean
  }
) =>
  Effect.runPromise(
    withCheckout(action, options).pipe(Effect.provide(BunServices.layer))
  )

describe('facts source checkout', () => {
  test('loads sectioned TypeScript for every config-owned locale', async () => {
    const release: CompiledFactsRelease = await runWithCheckout((root) =>
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
    expect(release.catalogues.map(({ locale }) => locale)).toEqual(['en', 'ru'])
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
    expect(release.objects.find(({ kind }) => kind === 'asset')?.bytes).toEqual(
      fixtureAssetBytes
    )
  })

  test('ignores undeclared files in the reviewed asset directory', async () => {
    const release = await runWithCheckout(
      (root) => compileFactsCheckout(root, provenance),
      { extraAsset: true }
    )

    expect(release.objects.filter(({ kind }) => kind === 'asset')).toHaveLength(
      1
    )
  })

  test('reports invalid authored asset file names at the schema boundary', async () => {
    const error = await runWithCheckout((root) =>
      Effect.gen(function* () {
        const fileSystem = yield* FileSystem
        const path = yield* Path
        yield* fileSystem.writeFileString(
          path.join(root, 'facts/assets.ts'),
          assetsSource.replace(
            "fileName: 'employment-review.pdf'",
            "fileName: '../employment-review.pdf'"
          )
        )
        return yield* Effect.flip(compileFactsCheckout(root, provenance))
      })
    )

    expect(error._tag).toBe('FactsAuthoring.ValidationError')
  })

  test('rejects asset symlinks that resolve outside the checkout', async () => {
    const error = await runWithCheckout(
      (root) => Effect.flip(compileFactsCheckout(root, provenance)),
      { assetSymlinkEscape: true }
    )

    expect(error._tag).toBe('FactsToolchainSourceError')
    if (error._tag === 'FactsToolchainSourceError') {
      expect(error.operation).toBe('load-source')
      expect(error.message).toContain('escapes the content checkout')
    }
  })

  test('rejects a configured locale whose source tree is missing', async () => {
    const error = await runWithCheckout(
      (root) => Effect.flip(compileFactsCheckout(root, provenance)),
      { omitRussian: true }
    )

    expect(error._tag).toBe('FactsToolchainSourceError')
    if (error._tag === 'FactsToolchainSourceError') {
      expect(error.operation).toBe('load-source')
    }
  })
})

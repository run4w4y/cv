import { describe, expect, test } from 'bun:test'
import {
  fixtureAssetBytes,
  fixtureProvenance,
  makeInMemoryFactsReleasePublication,
} from '@cv/facts-release/test-support'
import { BunServices } from '@effect/platform-bun'
import { Effect, Redacted } from 'effect'
import { FileSystem } from 'effect/FileSystem'
import { Path } from 'effect/Path'

import type { FactsPublisherConfig } from './config'
import { publishFactsCheckout } from './publish'

const withCheckout = <A, E, R>(
  action: (root: string) => Effect.Effect<A, E, R>
) =>
  Effect.scoped(
    Effect.gen(function* () {
      const fileSystem = yield* FileSystem
      const path = yield* Path
      const root = yield* fileSystem.makeTempDirectoryScoped({
        prefix: 'cv-facts-publication-',
      })
      yield* Effect.all(
        ['assets', 'en', 'ru'].map((directory) =>
          fileSystem.makeDirectory(path.join(root, 'facts', directory), {
            recursive: true,
          })
        ),
        { concurrency: 'unbounded' }
      )
      const section = (name: string, statement: string) => `export default {
        kind: 'identity',
        name: '${name}',
        facts: [{ text: '${statement}' }],
        languages: [],
      }`
      yield* Effect.all(
        [
          fileSystem.writeFileString(
            path.join(root, 'facts.config.ts'),
            `export default {
        defaultLocale: 'en',
        factsDir: 'facts',
        locales: ['en', 'ru'],
      }`
          ),
          fileSystem.writeFileString(
            path.join(root, 'facts/assets.ts'),
            `export default {
        'asset.employment-review': {
          description: 'Reviewed supporting material.',
          fileName: 'employment-review.pdf',
          label: 'Employment review',
          mediaType: 'application/pdf',
        },
      }`
          ),
          fileSystem.writeFileString(
            path.join(root, 'facts/en/identity.ts'),
            section('Ada Lovelace', 'Works as a software engineer.')
          ),
          fileSystem.writeFileString(
            path.join(root, 'facts/ru/identity.ts'),
            section('Ада Лавлейс', 'Работает инженером-программистом.')
          ),
          fileSystem.writeFile(
            path.join(root, 'facts/assets/employment-review.pdf'),
            fixtureAssetBytes
          ),
        ],
        { concurrency: 'unbounded' }
      )
      return yield* action(root)
    })
  )

describe('facts checkout publication', () => {
  test('publishes the static R2 layout and is idempotent on a rerun', async () => {
    const { first, second, target } = await Effect.runPromise(
      withCheckout((contentRoot) =>
        Effect.gen(function* () {
          const config: FactsPublisherConfig = {
            compilerCommit: fixtureProvenance.compiler.commit,
            compilerRepository: fixtureProvenance.compiler.repository,
            contentRoot,
            r2AccessKeyId: Redacted.make('access-key'),
            r2AccountId: 'c'.repeat(32),
            r2Bucket: 'cv-facts',
            r2SecretAccessKey: Redacted.make('secret-key'),
            sourceCommit: fixtureProvenance.source.commit,
            sourceRepository: fixtureProvenance.source.repository,
          }
          const target = makeInMemoryFactsReleasePublication()
          const first = yield* publishFactsCheckout(config, target.layer)
          const second = yield* publishFactsCheckout(config, target.layer)
          return { first, second, target }
        })
      ).pipe(Effect.provide(BunServices.layer))
    )

    expect(first.status).toBe('activated')
    expect(second.status).toBe('already-active')
    expect(second.releaseId).toBe(first.releaseId)
    expect(target.objects.has('current.json')).toBe(true)
    expect(
      target.objects.has(`releases/${first.releaseId}/manifest.json`)
    ).toBe(true)
    expect(
      target.objects.has(`releases/${first.releaseId}/locales/en.json`)
    ).toBe(true)
    expect(
      target.objects.has(`releases/${first.releaseId}/locales/ru.json`)
    ).toBe(true)
    expect(
      [...target.objects.keys()].some((key) => key.startsWith('assets/sha256/'))
    ).toBe(true)
  })
})

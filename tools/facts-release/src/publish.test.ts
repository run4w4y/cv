import { describe, expect, test } from 'bun:test'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  fixtureAssetBytes,
  fixtureProvenance,
  makeInMemoryFactsReleasePublication,
} from '@cv/facts-release/test-support'
import { Effect, Redacted } from 'effect'

import type { FactsPublisherConfig } from './config'
import { publishFactsCheckout } from './publish'

const withCheckout = async <A>(action: (root: string) => Promise<A>) => {
  const root = await mkdtemp(join(tmpdir(), 'cv-facts-publication-'))
  try {
    await mkdir(join(root, 'facts/assets'), { recursive: true })
    await mkdir(join(root, 'facts/en'), { recursive: true })
    await mkdir(join(root, 'facts/ru'), { recursive: true })
    await writeFile(
      join(root, 'facts.config.ts'),
      `export default {
        defaultLocale: 'en',
        factsDir: 'facts',
        locales: ['en', 'ru'],
      }`
    )
    await writeFile(
      join(root, 'facts/assets.ts'),
      `export default {
        'asset.employment-review': {
          description: 'Reviewed supporting material.',
          fileName: 'employment-review.pdf',
          label: 'Employment review',
          mediaType: 'application/pdf',
        },
      }`
    )
    const section = (name: string, statement: string) => `export default {
      kind: 'identity',
      name: '${name}',
      facts: [{ text: '${statement}' }],
      languages: [],
    }`
    await writeFile(
      join(root, 'facts/en/identity.ts'),
      section('Ada Lovelace', 'Works as a software engineer.')
    )
    await writeFile(
      join(root, 'facts/ru/identity.ts'),
      section('Ада Лавлейс', 'Работает инженером-программистом.')
    )
    await writeFile(
      join(root, 'facts/assets/employment-review.pdf'),
      fixtureAssetBytes
    )
    return await action(root)
  } finally {
    await rm(root, { force: true, recursive: true })
  }
}

describe('facts checkout publication', () => {
  test('publishes the static R2 layout and is idempotent on a rerun', async () => {
    await withCheckout(async (contentRoot) => {
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

      const first = await Effect.runPromise(
        publishFactsCheckout(config, target.layer)
      )
      const second = await Effect.runPromise(
        publishFactsCheckout(config, target.layer)
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
        [...target.objects.keys()].some((key) =>
          key.startsWith('assets/sha256/')
        )
      ).toBe(true)
    })
  })
})

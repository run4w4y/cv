import { describe, expect, test } from 'bun:test'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  factsCatalogueFixture,
  fixtureAssetBytes,
} from '@cv/facts-release/test-support'
import { Effect } from 'effect'

import { compileFactsCheckout } from './source'

const digest = async (bytes: Uint8Array) => {
  const value = await crypto.subtle.digest('SHA-256', bytes.slice())
  return Buffer.from(value).toString('hex')
}

const provenance = {
  compilerCommit: 'b'.repeat(40),
  compilerRepository: 'run4w4y/cv',
  sourceCommit: 'a'.repeat(40),
  sourceRepository: 'run4w4y/cv-content',
}

const withCheckout = async <A>(
  action: (root: string) => Promise<A>,
  options: { readonly extraAsset?: boolean; readonly reviewedSha?: string } = {}
) => {
  const root = await mkdtemp(join(tmpdir(), 'cv-facts-checkout-'))
  try {
    const assets = join(root, 'facts/assets')
    await mkdir(assets, { recursive: true })
    const reviewedSha = options.reviewedSha ?? (await digest(fixtureAssetBytes))
    await writeFile(
      join(root, 'facts/catalogue.json'),
      `${JSON.stringify(factsCatalogueFixture(reviewedSha))}\n`
    )
    await writeFile(
      join(assets, 'asset.employment-review.pdf'),
      fixtureAssetBytes
    )
    if (options.extraAsset) {
      await writeFile(join(assets, 'asset.unreviewed.txt'), 'not reviewed')
    }
    return await action(root)
  } finally {
    await rm(root, { force: true, recursive: true })
  }
}

describe('facts source checkout', () => {
  test('compiles the reviewed catalogue and exact asset bytes with immutable provenance', async () => {
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
      expect(release.releaseId).toBe(`fr_${release.manifestObject.sha256}`)
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
          expect(error.operation).toBe('resolve-assets')
        }
      },
      { extraAsset: true }
    )
  })

  test('rejects source bytes that do not match the human-reviewed digest', async () => {
    await withCheckout(
      async (root) => {
        const error = await Effect.runPromise(
          Effect.flip(compileFactsCheckout(root, provenance))
        )

        expect(error._tag).toBe('FactsReleaseAssetError')
        if (error._tag === 'FactsReleaseAssetError') {
          expect(error.issue).toBe('digest-mismatch')
        }
      },
      { reviewedSha: '0'.repeat(64) }
    )
  })
})

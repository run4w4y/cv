import type { FactsCatalogueV1 } from '@cv/contracts/facts'
import { Effect, Layer } from 'effect'
import type { FactsReleaseProvenance, PublishedFactsObject } from '../model'
import { FactsReleasePublicationTarget } from '../publication'

export const fixtureAssetBytes = new TextEncoder().encode(
  'reviewed supporting material'
)

export const fixtureProvenance: FactsReleaseProvenance = {
  compiler: {
    commit: 'b'.repeat(40),
    repository: 'cv',
  },
  source: {
    commit: 'a'.repeat(40),
    repository: 'cv-content',
  },
}

export const factsCatalogueFixture = (
  assetSha256: string,
  locale = 'en',
  statement = locale === 'ru'
    ? 'Работает инженером-программистом в Analytical Engines с 2023 года по настоящее время.'
    : 'Worked as a software engineer at Analytical Engines from 2023 to the present.'
) =>
  ({
    $schema: 'cv.facts.v1',
    assets: [
      {
        description: 'Reviewed supporting material for the employment claim.',
        id: 'asset.employment-review',
        label: 'Employment review',
        mediaType: 'application/pdf',
        sha256: assetSha256,
      },
    ],
    evidence: [
      {
        id: 'evidence.employment-history-review',
        kind: 'personal-review',
        title: 'Reviewed employment history',
      },
    ],
    sections: [
      {
        kind: 'identity',
        name: 'Ada Lovelace',
        facts: [
          {
            evidenceIds: ['evidence.employment-history-review'],
            id: 'identity.employment-summary',
            text: statement,
          },
        ],
        languages: [],
      },
    ],
    locale,
  }) satisfies FactsCatalogueV1

export type InMemoryFactsReleasePublication = {
  readonly layer: Layer.Layer<FactsReleasePublicationTarget>
  readonly objects: ReadonlyMap<string, PublishedFactsObject>
  readonly writes: ReadonlyArray<string>
}

export const makeInMemoryFactsReleasePublication =
  (): InMemoryFactsReleasePublication => {
    const objects = new Map<string, PublishedFactsObject>()
    const writes: string[] = []
    const put = (object: PublishedFactsObject) => {
      writes.push(object.key)
      objects.set(object.key, { ...object, bytes: object.bytes.slice() })
    }

    return {
      layer: Layer.succeed(FactsReleasePublicationTarget, {
        putCurrent: (object) =>
          Effect.sync(() => {
            const existing = objects.get(object.key)
            if (
              existing !== undefined &&
              existing.bytes.byteLength === object.bytes.byteLength &&
              existing.bytes.every(
                (value, index) => value === object.bytes[index]
              )
            ) {
              return 'already-active' as const
            }
            put(object)
            return 'activated' as const
          }),
        putImmutable: (object) => Effect.sync(() => put(object)),
      }),
      objects,
      writes,
    }
  }

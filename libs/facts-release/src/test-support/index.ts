import type { FactsCatalogueV1 } from '@cv/contracts/facts'
import { Effect, Layer } from 'effect'
import type {
  FactsReleaseObject,
  FactsReleaseProvenance,
  FactsReleaseRegistration,
} from '../model'
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

export const factsCatalogueFixture = (assetSha256: string) =>
  ({
    $schema: 'cv.facts.v1',
    assets: [
      {
        claimIds: ['employment.analytical-engine.role'],
        description: 'Reviewed supporting material for the employment claim.',
        id: 'asset.employment-review',
        label: 'Employment review',
        mediaType: 'application/pdf',
        sha256: assetSha256,
      },
    ],
    claims: [
      {
        evidence: [
          {
            kind: 'personal-review',
            label: 'Reviewed employment history',
          },
        ],
        id: 'employment.analytical-engine.role',
        statement:
          'Worked as a software engineer at Analytical Engines from 2023 to the present.',
        status: 'approved',
        tags: ['role.software-engineering'],
        topic: 'employment',
      },
    ],
    locale: 'en',
    presets: [
      {
        claimIds: ['employment.analytical-engine.role'],
        id: 'preset.experience.analytical-engine',
        purpose: 'experience-summary',
        status: 'approved',
        tags: ['role.software-engineering'],
        text: 'Software engineer at Analytical Engines since 2023.',
      },
    ],
  }) satisfies FactsCatalogueV1

export type InMemoryFactsReleasePublication = {
  readonly layer: Layer.Layer<FactsReleasePublicationTarget>
  readonly objects: ReadonlyMap<string, FactsReleaseObject>
  readonly registrations: ReadonlyArray<FactsReleaseRegistration>
}

export const makeInMemoryFactsReleasePublication =
  (): InMemoryFactsReleasePublication => {
    const objects = new Map<string, FactsReleaseObject>()
    const registrations: FactsReleaseRegistration[] = []

    return {
      layer: Layer.succeed(FactsReleasePublicationTarget, {
        putObject: (object) =>
          Effect.sync(() => {
            objects.set(object.key, { ...object, bytes: object.bytes.slice() })
          }),
        register: (registration) =>
          Effect.sync(() => {
            registrations.push(registration)
          }),
      }),
      objects,
      registrations,
    }
  }

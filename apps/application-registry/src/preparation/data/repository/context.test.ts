import { describe, expect, test } from 'bun:test'
import { cvGenerationGuidanceTestFixture } from '@cv/application-preparation-workflow/test-support'
import type { Application } from '@cv/application-registry-entity'
import type { FactsReaderShape } from '@cv/facts-reader/reader'
import { Effect } from 'effect'

import type { RegistryClient } from '@/lib/registry-client'
import { makePreparationContextRepository } from './context'

const application: Application = {
  applicationStatus: 'not_started',
  appliedAt: null,
  company: 'Example',
  createdAt: '2026-07-16T09:00:00.000Z',
  followUpAt: null,
  id: 'application-1',
  listingAvailability: 'open',
  listingCheckedAt: null,
  listingClosedCandidateAt: null,
  listingConfidence: null,
  listingConsecutiveClosedChecks: 0,
  listingReasonCode: null,
  location: null,
  personalPriority: null,
  postingUrl: 'https://example.test/jobs/one',
  role: 'Staff Engineer',
  targetStage: 'apply_next',
  updatedAt: '2026-07-16T09:00:00.000Z',
  updatedRevision: 1,
  version: 2,
}

const unusedFacts = {
  read: () => Effect.die('Facts must not load before bootstrap prerequisites.'),
  readActiveRelease: () =>
    Effect.die('Facts must not load before bootstrap prerequisites.'),
  readGenerationGuidance: () =>
    Effect.die('Facts must not load before bootstrap prerequisites.'),
} as unknown as FactsReaderShape

const contextRepository = (
  registry: object,
  facts: FactsReaderShape = unusedFacts
) =>
  makePreparationContextRepository(
    registry as RegistryClient['Service'],
    facts,
    () => Effect.die('Content must not load before bootstrap prerequisites.')
  )

describe('preparation repository', () => {
  test('loads active CV guidance without reading a locale catalogue', async () => {
    const facts = {
      read: () => Effect.die('A catalogue must not be read for guidance.'),
      readActiveRelease: () =>
        Effect.die('Metadata must not be loaded separately for guidance.'),
      readGenerationGuidance: () =>
        Effect.succeed({
          generationGuidance: cvGenerationGuidanceTestFixture,
          releaseId: 'fr_release-1',
        }),
    } as unknown as FactsReaderShape
    const repository = contextRepository({}, facts)

    const result = await Effect.runPromise(
      repository.loadCvGenerationGuidance()
    )

    expect(result).toEqual({
      factsReleaseId: 'fr_release-1',
      guidance: cvGenerationGuidanceTestFixture,
    })
  })

  test('does not read context after the preparation lifecycle transition fails', async () => {
    const calls: string[] = []
    const repository = contextRepository({
      applications: {
        getApplication: () =>
          Effect.sync(() => {
            calls.push('get-application')
            return application
          }),
        updateApplication: () =>
          Effect.sync(() => calls.push('update-application')).pipe(
            Effect.andThen(
              Effect.fail({
                _tag: 'InternalServerError' as const,
                message: 'Transition failed.',
              })
            )
          ),
      },
      content: {
        ensureContentEntry: () =>
          Effect.sync(() => calls.push('ensure-content')).pipe(
            Effect.andThen(Effect.die('unexpected content creation'))
          ),
      },
    })

    const result = await Effect.runPromise(
      Effect.result(
        repository.loadBootstrap({
          applicationId: application.id,
          kind: 'cv',
          locale: 'en',
        })
      )
    )

    expect(result._tag).toBe('Failure')
    expect(calls).toEqual(['get-application', 'update-application'])
  })
})

import { describe, expect, test } from 'bun:test'
import { Effect, Exit, Schema } from 'effect'

import { cvGenerationGuidanceTestFixture } from '../test-support'
import {
  AiWorkflowTargetSchema,
  PreparationBatchTargetsSchema,
  PreparationJobInputSchema,
  preparationJobArtifactInputs,
} from './input'

const postingTarget = {
  _tag: 'PostingUrl' as const,
  url: 'https://jobs.example.test/platform',
}

const existingTarget = {
  _tag: 'ExistingApplication' as const,
  applicationId: 'application-1',
  factsReleaseId: 'facts-1',
  jobSnapshotId: 'snapshot-1',
  url: 'https://jobs.example.test/platform',
}

describe('AI workflow input', () => {
  test('uses one target union for posting URLs and existing applications', async () => {
    await expect(
      Effect.runPromise(AiWorkflowTargetSchema.makeEffect(postingTarget))
    ).resolves.toEqual(postingTarget)
    await expect(
      Effect.runPromise(AiWorkflowTargetSchema.makeEffect(existingTarget))
    ).resolves.toEqual(existingTarget)

    const invalid = await Effect.runPromiseExit(
      Schema.decodeUnknownEffect(AiWorkflowTargetSchema)({
        _tag: 'PostingUrl',
        url: 'file:///private/job.html',
      })
    )
    expect(Exit.isFailure(invalid)).toBe(true)
  })

  test('requires a CV for posting URL jobs', async () => {
    const invalid = await Effect.runPromiseExit(
      PreparationJobInputSchema.makeEffect({
        artifacts: {
          coverLetter: { prompt: 'Write a concise letter.' },
          cv: null,
        },
        jobId: 'job-1',
        locale: 'en',
        target: postingTarget,
      })
    )
    expect(Exit.isFailure(invalid)).toBe(true)
  })

  test('allows an existing application to request only a cover letter', async () => {
    const input = await Effect.runPromise(
      PreparationJobInputSchema.makeEffect({
        artifacts: {
          coverLetter: { prompt: 'Write a concise letter.' },
          cv: null,
        },
        jobId: 'job-1',
        locale: 'en',
        target: existingTarget,
      })
    )
    expect(preparationJobArtifactInputs(input)).toMatchObject([
      {
        kind: 'cover_letter',
        runId: 'job-1:cover-letter',
        source: {
          _tag: 'ReviewedContext',
          applicationId: 'application-1',
        },
      },
    ])
  })

  test('derives deterministic artifact execution inputs from one job payload', async () => {
    const input = await Effect.runPromise(
      PreparationJobInputSchema.makeEffect({
        artifacts: {
          coverLetter: { prompt: 'Write a concise letter.' },
          cv: { generationGuidance: cvGenerationGuidanceTestFixture },
        },
        jobId: 'job-1',
        locale: 'en',
        target: postingTarget,
      })
    )
    expect(
      preparationJobArtifactInputs(input).map(({ kind, runId }) => ({
        kind,
        runId,
      }))
    ).toEqual([
      { kind: 'cv', runId: 'job-1:cv' },
      { kind: 'cover_letter', runId: 'job-1:cover-letter' },
    ])
  })

  test('bounds unified workflow batches', async () => {
    const maximum = Array.from({ length: 25 }, (_, index) => ({
      _tag: 'PostingUrl' as const,
      url: `https://jobs.example.test/${index}`,
    }))
    await expect(
      Effect.runPromise(PreparationBatchTargetsSchema.makeEffect(maximum))
    ).resolves.toHaveLength(25)
    expect(
      Exit.isFailure(
        await Effect.runPromiseExit(
          PreparationBatchTargetsSchema.makeEffect([
            ...maximum,
            {
              _tag: 'PostingUrl',
              url: 'https://jobs.example.test/overflow',
            },
          ])
        )
      )
    ).toBe(true)
  })
})

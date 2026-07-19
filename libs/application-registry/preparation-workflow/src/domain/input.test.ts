import { describe, expect, test } from 'bun:test'
import { Effect, Schema } from 'effect'

import {
  canonicalPreparationUrl,
  maximumCoverLetterPromptLength,
  maximumPreparationBatchSize,
  PreparationBatchUrlsSchema,
  PreparationWorkflowInputSchema,
} from './input'

describe('preparation workflow inputs', () => {
  test('canonicalizes equivalent fragment URLs to one workflow identity', () => {
    expect(
      canonicalPreparationUrl(' https://JOBS.example.test/role#application ')
    ).toBe('https://jobs.example.test/role')
  })

  test('rejects credential-bearing URLs and malformed locales', async () => {
    await expect(
      Effect.runPromise(
        PreparationBatchUrlsSchema.makeEffect([
          'https://user:secret@jobs.example.test/role',
        ])
      )
    ).rejects.toBeDefined()

    await expect(
      Effect.runPromise(
        Schema.decodeUnknownEffect(PreparationWorkflowInputSchema)({
          coverLetterPrompt: null,
          kind: 'cv',
          locale: 'x',
          modelId: 'model-1',
          runId: 'run-1',
          source: {
            _tag: 'CaptureUrl',
            url: 'https://jobs.example.test/role',
          },
        })
      )
    ).rejects.toBeDefined()
  })

  test('enforces the in-memory batch admission bound', async () => {
    const maximum = Array.from(
      { length: maximumPreparationBatchSize },
      (_, index) => `https://jobs.example.test/${index}`
    )
    await expect(
      Effect.runPromise(PreparationBatchUrlsSchema.makeEffect(maximum))
    ).resolves.toHaveLength(maximumPreparationBatchSize)

    await expect(
      Effect.runPromise(
        PreparationBatchUrlsSchema.makeEffect([
          ...maximum,
          'https://jobs.example.test/overflow',
        ])
      )
    ).rejects.toBeDefined()
  })

  test('bounds user-authored cover-letter instructions', async () => {
    await expect(
      Effect.runPromise(
        Schema.decodeUnknownEffect(PreparationWorkflowInputSchema)({
          coverLetterPrompt: 'x'.repeat(maximumCoverLetterPromptLength + 1),
          kind: 'cover_letter',
          locale: 'en',
          modelId: 'model-1',
          runId: 'run-prompt-limit',
          source: {
            _tag: 'CaptureUrl',
            url: 'https://jobs.example.test/role',
          },
        })
      )
    ).rejects.toBeDefined()
  })

  test('requires immutable snapshot and facts pins for reviewed context', async () => {
    await expect(
      Effect.runPromise(
        Schema.decodeUnknownEffect(PreparationWorkflowInputSchema)({
          coverLetterPrompt: null,
          kind: 'cv',
          locale: 'en',
          modelId: 'model-1',
          runId: 'run-reviewed',
          source: {
            _tag: 'ReviewedContext',
            applicationId: 'application-1',
            url: 'https://jobs.example.test/role',
          },
        })
      )
    ).rejects.toBeDefined()
  })
})

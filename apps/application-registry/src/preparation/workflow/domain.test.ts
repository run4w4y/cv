import { describe, expect, test } from 'bun:test'
import { Effect, Schema } from 'effect'

import {
  canonicalPreparationUrl,
  GeneratedCandidateSchema,
  maximumCoverLetterPromptLength,
  maximumPreparationBatchSize,
  PreparationBatchUrlsSchema,
  PreparationWorkflowInputSchema,
} from './domain'

describe('preparation workflow input schemas', () => {
  test('canonicalizes equivalent fragment URLs to one workflow identity', () => {
    expect(
      canonicalPreparationUrl(' https://JOBS.example.test/role#application ')
    ).toBe('https://jobs.example.test/role')
  })

  test('rejects credential-bearing URLs and malformed locales before execution', async () => {
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

  test('accepts the bounded maximum of HTTP(S) URLs', async () => {
    const urls = Array.from(
      { length: maximumPreparationBatchSize },
      (_, index) => `https://jobs.example.test/${index}`
    )

    await expect(
      Effect.runPromise(PreparationBatchUrlsSchema.makeEffect(urls))
    ).resolves.toHaveLength(maximumPreparationBatchSize)
  })

  test('rejects batches beyond the in-memory admission limit', async () => {
    const urls = Array.from(
      { length: maximumPreparationBatchSize + 1 },
      (_, index) => `https://jobs.example.test/${index}`
    )

    await expect(
      Effect.runPromise(PreparationBatchUrlsSchema.makeEffect(urls))
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

  test('validates the exact tagged document contract at workflow boundaries', async () => {
    await expect(
      Effect.runPromise(
        Schema.decodeUnknownEffect(GeneratedCandidateSchema)({
          _tag: 'CoverLetter',
          document: {
            $schema: 'cover-letter.v1',
            body: 'I build reliable platforms.',
            locale: 'en',
          },
          metadata: [],
        })
      )
    ).resolves.toMatchObject({ _tag: 'CoverLetter' })

    await expect(
      Effect.runPromise(
        Schema.decodeUnknownEffect(GeneratedCandidateSchema)({
          _tag: 'Cv',
          document: {
            $schema: 'cover-letter.v1',
            body: 'Wrong contract for this tag.',
            locale: 'en',
          },
          metadata: [],
        })
      )
    ).rejects.toBeDefined()
  })
})

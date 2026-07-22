import { describe, expect, test } from 'bun:test'
import { Effect, Schema } from 'effect'

import { GeneratedCandidateSchema } from './candidate'

describe('generated candidates', () => {
  test('validates the exact tagged document contract', async () => {
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

import { describe, expect, test } from 'bun:test'
import { Schema } from 'effect'

import {
  collectGenerationGuidance,
  GenerationGuidanceAnnotationId,
} from './guidance'

describe('collectGenerationGuidance', () => {
  test('walks arbitrary Effect Schema fields by JSON pointer', () => {
    const schema = Schema.Struct({
      neverHardCodedByTheUi: Schema.String.annotate({
        [GenerationGuidanceAnnotationId]: {
          instruction: 'Use the supplied source.',
          sources: ['trusted-facts'],
        },
      }),
    })

    expect(collectGenerationGuidance(schema)).toEqual([
      {
        instruction: 'Use the supplied source.',
        pointer: '/neverHardCodedByTheUi',
        sources: ['trusted-facts'],
        title: null,
      },
    ])
  })
})

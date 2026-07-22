import { describe, expect, test } from 'bun:test'
import { Effect, Schema } from 'effect'

import { JobAnalysisSchema } from './generation'

describe('preparation generation schemas', () => {
  test('rejects duplicate requirement IDs', async () => {
    await expect(
      Effect.runPromise(
        Schema.decodeUnknownEffect(JobAnalysisSchema)({
          company: null,
          keywords: [],
          location: null,
          requirements: [
            { id: 'req.effect', priority: 'required', text: 'Know Effect.' },
            { id: 'req.effect', priority: 'preferred', text: 'Know queues.' },
          ],
          responsibilities: [],
          role: 'Platform engineer',
          summary: 'A platform role.',
        })
      )
    ).rejects.toBeDefined()
  })
})

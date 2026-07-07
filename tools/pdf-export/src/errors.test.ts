import { describe, expect, test } from 'bun:test'
import { Effect } from 'effect'
import { PdfUsageError } from './errors'

describe('pdf export errors', () => {
  test('PdfUsageError.fail returns a typed usage error', async () => {
    const result = await Effect.runPromiseExit(PdfUsageError.fail('No profile'))

    expect(result._tag).toBe('Failure')
    expect(result.toString()).toContain('PdfUsageError')
    expect(result.toString()).toContain('No profile')
  })
})

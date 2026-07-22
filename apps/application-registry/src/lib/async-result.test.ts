import { describe, expect, test } from 'bun:test'
import { Cause } from 'effect'
import * as AsyncResult from 'effect/unstable/reactivity/AsyncResult'

import {
  asyncResultError,
  asyncResultErrorMessage,
  firstAsyncResultErrorMessage,
} from './async-result'

describe('AsyncResult presentation', () => {
  test('preserves typed failures for tag-based handling', () => {
    const error = Object.assign(new Error('stale version'), {
      _tag: 'ConflictError' as const,
    })
    const result = AsyncResult.fail(error)

    expect(asyncResultError(result)).toBe(error)
    expect(asyncResultErrorMessage(result, 'fallback')).toBe('stale version')
  })

  test('does not expose defects as expected application failures', () => {
    const result = AsyncResult.failure(
      Cause.die(new Error('internal implementation detail'))
    )

    expect(asyncResultError(result)).toBeUndefined()
    expect(asyncResultErrorMessage(result, 'Something went wrong.')).toBe(
      'Something went wrong.'
    )
  })

  test('selects the first failure in command priority order', () => {
    expect(
      firstAsyncResultErrorMessage([
        { fallback: 'first fallback', result: AsyncResult.success(undefined) },
        { fallback: 'second fallback', result: AsyncResult.fail('second') },
        { fallback: 'third fallback', result: AsyncResult.fail('third') },
      ])
    ).toBe('second fallback')
  })
})

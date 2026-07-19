import { describe, expect, test } from 'bun:test'

import { cancelPreparationRunAtom } from './review'

describe('preparation command atoms', () => {
  test('isolates cancellation state by run id', () => {
    expect(cancelPreparationRunAtom('run-1')).toBe(
      cancelPreparationRunAtom('run-1')
    )
    expect(cancelPreparationRunAtom('run-1')).not.toBe(
      cancelPreparationRunAtom('run-2')
    )
  })
})

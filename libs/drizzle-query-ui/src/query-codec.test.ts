import { describe, expect, test } from 'bun:test'

import { queryFiltersStateFromFilterNodes } from './query-codec'

describe('query filter editor bridge', () => {
  test('leaves nested and NOT groups valid but outside the flat editor', () => {
    expect(
      queryFiltersStateFromFilterNodes([
        {
          type: 'group',
          combinator: 'not',
          children: [
            {
              type: 'condition',
              field: 'applicationStatus',
              operator: 'eq',
              value: 'rejected',
            },
          ],
        },
      ])
    ).toBeUndefined()
  })
})

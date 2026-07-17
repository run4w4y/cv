import { describe, expect, test } from 'bun:test'
import type { ApplicationCompensation } from '@cv/application-registry-entity'

import {
  applicationListRecord,
  compensation,
} from '../../test/support/fixtures'
import { toApplicationListItem } from './application-list-item'

const withCompensation = (
  overrides: Partial<ApplicationCompensation>
): ApplicationCompensation => ({ ...compensation, ...overrides })

describe('application list compensation', () => {
  test('prefers annual base salary in the requested display currency', () => {
    const total = withCompensation({
      currencyCode: 'GBP',
      id: 'annual-total',
      kind: 'total_compensation',
      maximumMinor: 18_000_000,
      minimumMinor: 15_000_000,
    })
    const base = withCompensation({ id: 'annual-base' })
    const convertedBase = withCompensation({
      currencyCode: 'USD',
      id: base.id,
      maximumMinor: 24_000_000,
      minimumMinor: 20_000_000,
    })

    const item = toApplicationListItem(
      {
        ...applicationListRecord,
        compensations: [total, base],
      },
      [convertedBase, total]
    )

    expect(item.annualCompensation).toEqual({
      currencyCode: 'USD',
      maximumMinor: 24_000_000,
      minimumMinor: 20_000_000,
    })
  })

  test('falls back to annual total compensation', () => {
    const total = withCompensation({
      currencyCode: 'GBP',
      id: 'annual-total',
      kind: 'total_compensation',
      maximumMinor: null,
      minimumMinor: 15_000_000,
    })

    const item = toApplicationListItem({
      ...applicationListRecord,
      compensations: [
        withCompensation({ id: 'monthly-base', period: 'month' }),
        total,
      ],
    })

    expect(item.annualCompensation).toEqual({
      currencyCode: 'GBP',
      maximumMinor: null,
      minimumMinor: 15_000_000,
    })
  })

  test('does not treat annual bonus or non-annual salary as annual compensation', () => {
    const item = toApplicationListItem({
      ...applicationListRecord,
      compensations: [
        withCompensation({ id: 'monthly-base', period: 'month' }),
        withCompensation({ id: 'annual-bonus', kind: 'bonus' }),
      ],
    })

    expect(item.annualCompensation).toBeNull()
  })
})

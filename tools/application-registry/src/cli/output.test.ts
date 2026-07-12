import { describe, expect, test } from 'bun:test'
import type { ApplicationCompensationResponseItem } from '@cv/application-registry-api-contract'
import { Effect } from 'effect'
import { TestConsole } from 'effect/testing'

import { printCompensations } from './output'

const compensation: ApplicationCompensationResponseItem = {
  conversion: {
    currencyCode: 'USD',
    maximumMinor: 8_160_000,
    minimumMinor: 5_440_000,
    observedAt: '2026-07-10T00:00:00.000Z',
    provider: 'frankfurter',
    rate: 0.0068,
  },
  original: {
    applicationId: 'application-1',
    createdAt: '2026-07-10T00:00:00.000Z',
    currencyCode: 'JPY',
    id: 'compensation-1',
    kind: 'base_salary',
    maximumMinor: 12_000_000,
    minimumMinor: 8_000_000,
    period: 'year',
    rawText: 'JPY 8–12M',
    source: 'job-board',
    updatedAt: '2026-07-10T00:00:00.000Z',
  },
}

const render = (items: readonly ApplicationCompensationResponseItem[]) =>
  Effect.gen(function* () {
    yield* printCompensations(items, false)
    return yield* TestConsole.logLines
  }).pipe(Effect.provide(TestConsole.layer), Effect.runPromise)

describe('compensation CLI output', () => {
  test('renders original and converted minor-unit ranges as currency amounts', async () => {
    const lines = await render([compensation])

    expect(lines).toEqual([
      [
        'Base salary',
        'Original: JPY 8,000,000–12,000,000 / year',
        'Converted: USD 54,400–81,600 / year',
        'Rate: 0.0068 (frankfurter, observed 2026-07-10T00:00:00.000Z)',
        'Source: job-board',
        'Raw: JPY 8–12M',
      ].join('\n'),
    ])
  })

  test('reports an empty compensation collection', async () => {
    expect(await render([])).toEqual(['No compensation records found.'])
  })
})

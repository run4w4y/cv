import { describe, expect, test } from 'bun:test'

import { newApplicationRequest } from './render'

const values = {
  jobKey: 'manual:acme-staff',
  source: 'manual',
  sourceJobId: '',
  canonicalUrl: 'https://example.test/jobs/staff',
  company: 'Acme',
  role: 'Staff Engineer',
  location: 'Remote',
  applicationStatus: 'not_started' as const,
  targetStage: 'apply_next' as const,
  currencyCode: 'usd',
  annualFrom: '150000',
  annualTo: '180000',
}

describe('newApplicationRequest', () => {
  test('maps annual from/to fields to one original-currency base salary row', () => {
    const request = newApplicationRequest(values)

    expect(request.compensations).toEqual([
      {
        kind: 'base_salary',
        currencyCode: 'USD',
        minimumMinor: 15_000_000,
        maximumMinor: 18_000_000,
        period: 'year',
        rawText: null,
        source: 'manual',
      },
    ])
  })

  test("uses each currency's actual minor-unit precision", () => {
    const jpy = newApplicationRequest({
      ...values,
      currencyCode: 'JPY',
      annualFrom: '10000000',
      annualTo: '',
    })
    const kwd = newApplicationRequest({
      ...values,
      currencyCode: 'KWD',
      annualFrom: '1234.567',
      annualTo: '',
    })

    expect(jpy.compensations?.[0]?.minimumMinor).toBe(10_000_000)
    expect(kwd.compensations?.[0]?.minimumMinor).toBe(1_234_567)
  })

  test('requires a valid currency when either bound is entered', () => {
    expect(() =>
      newApplicationRequest({
        ...values,
        currencyCode: '',
        annualFrom: '1000',
      })
    ).toThrow('three-letter currency code')
  })
})

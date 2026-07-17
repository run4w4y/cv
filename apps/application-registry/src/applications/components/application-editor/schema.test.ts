import { describe, expect, it } from 'bun:test'
import { Schema } from 'effect'

import {
  ApplicationDetailEditFormSchema,
  ApplicationRowEditFormSchema,
} from './schema'

const rowInput = {
  company: ' Acme ',
  location: ' ',
  role: ' Platform engineer ',
  applicationStatus: 'applied' as const,
  targetStage: 'apply_next' as const,
  fitScore: '82',
  personalPriority: null,
  labels: [' remote ', 'typescript'],
  annualCompensation: {
    currencyCode: 'usd',
    from: '120000',
    to: '150000',
  },
  followUpAt: new Date('2026-07-20T12:30:00.000Z'),
}

describe('application edit form schema', () => {
  it('normalizes row values into the management command domain', () => {
    const decoded = Schema.decodeUnknownSync(ApplicationRowEditFormSchema)(
      rowInput
    )
    expect(decoded.company).toBe('Acme')
    expect(decoded.location).toBeNull()
    expect(decoded.fitScore).toBe(82)
    expect(decoded.annualCompensation).toEqual({
      currencyCode: 'USD',
      minimumMinor: 12_000_000,
      maximumMinor: 15_000_000,
    })
    expect(decoded.followUpAt).toBe('2026-07-20T12:30:00.000Z')
  })

  it('rejects an inverted compensation range at the upper bound', () => {
    expect(() =>
      Schema.decodeUnknownSync(ApplicationRowEditFormSchema)({
        ...rowInput,
        annualCompensation: { ...rowInput.annualCompensation, to: '100000' },
      })
    ).toThrow(/greater than or equal/u)
  })

  it('rejects required text, invalid scores, and invalid URLs', () => {
    expect(() =>
      Schema.decodeUnknownSync(ApplicationDetailEditFormSchema)(
        {
          company: ' ',
          role: 'Role',
          canonicalUrl: 'not a url',
          location: '',
          applicationStatus: 'applied',
          targetStage: 'apply_next',
          personalPriority: null,
          fitScore: '101',
          category: '',
          remotePolicy: '',
          technologyStack: '',
          recommendedAction: '',
          followUpAt: null,
        },
        { errors: 'all' }
      )
    ).toThrow(/company|canonicalUrl|fitScore/u)
  })
})

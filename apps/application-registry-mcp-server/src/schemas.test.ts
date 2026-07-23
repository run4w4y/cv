import { describe, expect, test } from 'bun:test'
import {
  ApplicationCompanySchema,
  ApplicationRoleSchema,
  ApplicationCompensationInputSchema as CanonicalApplicationCompensationInputSchema,
} from '@cv/application-registry-entity'
import { Schema } from 'effect'

import {
  ApplicationCompensationInputSchema,
  CreateApplicationParametersSchema,
} from './schemas'

describe('MCP registry schemas', () => {
  test('reuses the canonical compensation input schema', () => {
    expect(ApplicationCompensationInputSchema).toBe(
      CanonicalApplicationCompensationInputSchema
    )
    expect(() =>
      Schema.decodeUnknownSync(CreateApplicationParametersSchema)({
        company: 'Example',
        compensations: [
          {
            kind: 'base_salary',
            currencyCode: 'USD',
            minimumMinor: 200_000,
            maximumMinor: 150_000,
            period: 'year',
            rawText: '$200k–$150k',
            source: 'job-board',
          },
        ],
        location: null,
        postingUrl: 'https://example.test/jobs/one',
        role: 'Engineer',
      })
    ).toThrow()
  })

  test('reuses canonical application identity fields', () => {
    expect(CreateApplicationParametersSchema.fields.company).toBe(
      ApplicationCompanySchema
    )
    expect(CreateApplicationParametersSchema.fields.role).toBe(
      ApplicationRoleSchema
    )
    expect(() =>
      Schema.decodeUnknownSync(CreateApplicationParametersSchema)({
        company: '   ',
        location: null,
        postingUrl: 'https://example.test/jobs/one',
        role: 'Engineer',
      })
    ).toThrow()
  })
})

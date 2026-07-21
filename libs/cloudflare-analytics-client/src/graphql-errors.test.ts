import { describe, expect, test } from 'bun:test'

import { extractGraphqlErrors } from './graphql-errors'

describe('Cloudflare GraphQL errors', () => {
  test('extracts messages without retaining raw error payloads', () => {
    expect(
      extractGraphqlErrors({
        errors: [{ message: 'bad zone' }, { detail: 'ignored' }],
      })
    ).toEqual(['bad zone'])
  })
})

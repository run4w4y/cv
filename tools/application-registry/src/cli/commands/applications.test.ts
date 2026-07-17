import { describe, expect, test } from 'bun:test'

import { formatApplicationFacets } from './applications'

describe('application facet CLI output', () => {
  test('renders only the dynamic facets exposed by the API', () => {
    expect(
      formatApplicationFacets({
        companies: ['Acme', 'Example'],
        labels: ['Remote', 'TypeScript'],
      })
    ).toBe(
      ['Companies: Acme, Example', 'Labels: Remote, TypeScript'].join('\n')
    )
  })

  test('renders an explicit empty state for each dynamic facet', () => {
    expect(formatApplicationFacets({ companies: [], labels: [] })).toBe(
      ['Companies: —', 'Labels: —'].join('\n')
    )
  })
})

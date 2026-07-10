import { describe, expect, test } from 'bun:test'
import { getTechIcon } from './tech-icon'

describe('bounded technology icon catalog', () => {
  test('normalizes versions and app-owned aliases', () => {
    expect(getTechIcon('React 19')?.slug).toBe('react')
    expect(getTechIcon('Tailwind CSS v4')?.slug).toBe('tailwindcss')
    expect(getTechIcon('GitHub Actions')?.slug).toBe('githubactions')
  })

  test('omits technologies outside the bounded catalog', () => {
    expect(getTechIcon('Some Future Runtime')).toBeUndefined()
  })
})

import { describe, expect, test } from 'bun:test'
import { render } from '@testing-library/react'

import { Spinner } from './spinner'

describe('Spinner', () => {
  test('has a default accessible status name', () => {
    const view = render(<Spinner />)
    expect(view.getByRole('status', { name: 'Loading' })).toBeTruthy()
  })

  test('can be decorative next to visible loading text', () => {
    const view = render(<Spinner aria-hidden="true" />)
    const spinner = view.container.querySelector('[data-slot="spinner"]')

    expect(spinner?.getAttribute('aria-hidden')).toBe('true')
    expect(spinner?.getAttribute('role')).toBeNull()
    expect(spinner?.getAttribute('aria-label')).toBeNull()
  })
})

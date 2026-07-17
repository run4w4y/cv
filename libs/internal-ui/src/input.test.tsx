import { afterEach, describe, expect, test } from 'bun:test'
import { cleanup, render } from '@testing-library/react'

import { Input } from './input'

afterEach(cleanup)

describe('Input', () => {
  test('uses destructive invalid decoration without changing its background', () => {
    const view = render(<Input aria-invalid />)
    const input = view.getByRole('textbox')

    expect(input.classList.contains('aria-invalid:border-destructive')).toBe(
      true
    )
    expect(input.classList.contains('aria-invalid:ring-destructive/20')).toBe(
      true
    )
    expect(input.classList.contains('bg-card')).toBe(true)
  })
})

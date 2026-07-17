import { afterEach, describe, expect, test } from 'bun:test'
import { cleanup, render } from '@testing-library/react'

import { Textarea } from './textarea'

afterEach(cleanup)

describe('Textarea', () => {
  test('uses destructive invalid decoration without changing its background', () => {
    const view = render(<Textarea aria-invalid />)
    const textarea = view.getByRole('textbox')

    expect(textarea.classList.contains('aria-invalid:border-destructive')).toBe(
      true
    )
    expect(
      textarea.classList.contains('aria-invalid:ring-destructive/20')
    ).toBe(true)
    expect(textarea.classList.contains('bg-card')).toBe(true)
  })
})

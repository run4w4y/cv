import { describe, expect, test } from 'bun:test'
import { renderToStaticMarkup } from 'react-dom/server'

import { StatusBadge, statusBadgeVariant } from './render'

describe('StatusBadge', () => {
  test('maps every status family to its semantic badge variant', () => {
    expect(statusBadgeVariant('rejected')).toBe('danger')
    expect(statusBadgeVariant('open')).toBe('success')
    expect(statusBadgeVariant('suspected_closed')).toBe('warning')
    expect(statusBadgeVariant('unchecked')).toBe('outline')
  })

  test('renders a human-readable status label', () => {
    const markup = renderToStaticMarkup(
      <StatusBadge value="technical_screen" />
    )

    expect(markup).toContain('Technical screen')
  })
})

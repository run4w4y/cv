import { describe, expect, test } from 'bun:test'
import { render } from '@testing-library/react'

import { Progress } from './progress'

describe('Progress', () => {
  test('exposes the current value and sizes its indicator', () => {
    const view = render(
      <Progress value={4} max={10} aria-label="Four of ten jobs complete" />
    )

    const progress = view.getByRole('progressbar', {
      name: 'Four of ten jobs complete',
    })
    const indicator = view.container.querySelector<HTMLElement>(
      '[data-slot="progress-indicator"]'
    )

    expect(progress.getAttribute('aria-valuenow')).toBe('4')
    expect(progress.getAttribute('aria-valuemax')).toBe('10')
    expect(indicator?.style.width).toBe('40%')
  })

  test('supports indeterminate progress', () => {
    const view = render(<Progress value={null} aria-label="Starting jobs" />)
    const progress = view.getByRole('progressbar', { name: 'Starting jobs' })

    expect(progress.getAttribute('aria-valuenow')).toBeNull()
    expect(progress.hasAttribute('data-indeterminate')).toBe(true)
  })
})

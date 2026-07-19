import { afterEach, describe, expect, test } from 'bun:test'
import { cleanup, render } from '@testing-library/react'

import { EventKindBadge } from './render'

afterEach(cleanup)

describe('ActivityKindBadge', () => {
  test('renders activity labels with semantic variants', () => {
    const view = render(<EventKindBadge kind="content_approved" />)
    const badge = view.getByText('Content approved')

    expect(badge.className).toContain('emerald')
    expect(badge.className).toContain('whitespace-normal')
  })
})

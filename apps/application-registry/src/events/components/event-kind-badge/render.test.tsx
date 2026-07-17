import { afterEach, describe, expect, test } from 'bun:test'
import { cleanup, render } from '@testing-library/react'

import { EventKindBadge } from './render'

afterEach(cleanup)

describe('EventKindBadge', () => {
  test('renders event labels with semantic variants', () => {
    const view = render(<EventKindBadge kind="offer_received" />)
    const badge = view.getByText('Offer received')

    expect(badge.className).toContain('emerald')
    expect(badge.className).toContain('whitespace-normal')
  })
})

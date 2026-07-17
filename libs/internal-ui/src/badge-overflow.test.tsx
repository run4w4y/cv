import { describe, expect, test } from 'bun:test'
import { renderToStaticMarkup } from 'react-dom/server'

import { BadgeOverflow } from './badge-overflow'

describe('BadgeOverflow', () => {
  test('bounds visible badges and renders an overflow summary', () => {
    const markup = renderToStaticMarkup(
      <BadgeOverflow items={['react', 'effect', 'drizzle']} maxVisible={2} />
    )

    expect(markup).toContain('react')
    expect(markup).toContain('effect')
    expect(markup).not.toContain('drizzle')
    expect(markup).toContain('+1')
  })
})

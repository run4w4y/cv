import { describe, expect, test } from 'bun:test'
import { renderToStaticMarkup } from 'react-dom/server'

import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from './empty'

describe('Empty', () => {
  test('renders its title and guidance', () => {
    const markup = renderToStaticMarkup(
      <Empty>
        <EmptyHeader>
          <EmptyTitle>No results</EmptyTitle>
          <EmptyDescription>Change the filters.</EmptyDescription>
        </EmptyHeader>
      </Empty>
    )

    expect(markup).toContain('data-slot="empty"')
    expect(markup).toContain('No results')
    expect(markup).toContain('Change the filters.')
  })
})

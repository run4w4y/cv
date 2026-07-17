import { describe, expect, test } from 'bun:test'
import { renderToStaticMarkup } from 'react-dom/server'

import { Card, CardContent, CardHeader, CardTitle } from './card'

describe('Card', () => {
  test('renders its composition slots', () => {
    const markup = renderToStaticMarkup(
      <Card>
        <CardHeader>
          <CardTitle>Application</CardTitle>
        </CardHeader>
        <CardContent>Application details</CardContent>
      </Card>
    )

    expect(markup).toContain('data-slot="card"')
    expect(markup).toContain('data-slot="card-header"')
    expect(markup).toContain('data-slot="card-content"')
  })
})

import { describe, expect, test } from 'bun:test'
import { renderToStaticMarkup } from 'react-dom/server'

import { BarChart } from './bar-chart'

describe('BarChart', () => {
  test('renders keyboard-focusable bars and their exact values', () => {
    const markup = renderToStaticMarkup(
      <BarChart
        ariaLabel="Application outcomes"
        data={[
          { label: 'Viewed', value: 12 },
          { label: 'Not viewed', value: 4 },
        ]}
      />
    )

    expect(markup).toContain('data-slot="bar-chart"')
    expect(markup).toContain('data-slot="chart-scroll-area"')
    expect(markup).toContain('aria-label="Application outcomes"')
    expect(markup).not.toContain('<title id=')
    expect(markup).toContain('aria-label="Viewed: 12"')
    expect(markup).toContain('tabindex="0"')
    expect(markup).toContain('<caption>Application outcomes</caption>')
  })

  test('uses the shared empty state for an empty category set', () => {
    const markup = renderToStaticMarkup(
      <BarChart ariaLabel="No outcomes" data={[]} emptyMessage="Nothing yet." />
    )

    expect(markup).toContain('Nothing yet.')
    expect(markup).toContain('data-slot="chart-empty-state"')
  })
})

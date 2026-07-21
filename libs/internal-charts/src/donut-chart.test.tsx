import { describe, expect, test } from 'bun:test'
import { renderToStaticMarkup } from 'react-dom/server'

import { DonutChart } from './donut-chart'

describe('DonutChart', () => {
  test('renders labelled segments, total, legend, and source table', () => {
    const markup = renderToStaticMarkup(
      <DonutChart
        ariaLabel="Link outcomes"
        data={[
          { label: 'Viewed', value: 15 },
          { label: 'Not viewed', value: 5 },
        ]}
      />
    )

    expect(markup).toContain('data-slot="donut-chart"')
    expect(markup).toContain('aria-label="Link outcomes"')
    expect(markup).not.toContain('<title id=')
    expect(markup).toContain('aria-label="Viewed: 15, 75.0%"')
    expect(markup).toContain('>20</span>')
    expect(markup).toContain('data-slot="chart-legend"')
    expect(markup).toContain('<caption>Link outcomes</caption>')
  })

  test('does not create arc geometry for zero-valued segments', () => {
    const markup = renderToStaticMarkup(
      <DonutChart
        ariaLabel="Link outcomes"
        data={[
          { label: 'Viewed', value: 1 },
          { label: 'Not viewed', value: 0 },
        ]}
      />
    )

    expect(markup).toContain('Viewed: 1, 100.0%')
    expect(markup).not.toContain('aria-label="Not viewed:')
  })
})

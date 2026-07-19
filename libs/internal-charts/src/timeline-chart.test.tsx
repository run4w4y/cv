import { describe, expect, test } from 'bun:test'
import { renderToStaticMarkup } from 'react-dom/server'

import { TimelineChart } from './timeline-chart'

const timelineData = [
  { date: '2026-07-16', views: 4, visitors: 3 },
  { date: '2026-07-17', views: 8, visitors: 6 },
  { date: '2026-07-18', views: 5, visitors: null },
]

describe('TimelineChart', () => {
  test('renders labelled series and an accessible source table', () => {
    const markup = renderToStaticMarkup(
      <TimelineChart
        ariaLabel="CV traffic"
        data={timelineData}
        description="Daily CV traffic."
        series={[
          { dataKey: 'views', label: 'Views', area: true },
          { dataKey: 'visitors', label: 'Visitors' },
        ]}
      />
    )

    expect(markup).toContain('data-slot="timeline-chart"')
    expect(markup).toContain('<title')
    expect(markup).toContain('CV traffic')
    expect(markup).toContain('Views, Jul 16: 4')
    expect(markup).toContain('data-slot="chart-data-table"')
    expect(markup).toContain('<caption>CV traffic</caption>')
  })

  test('renders the shared empty state when no values can be plotted', () => {
    const markup = renderToStaticMarkup(
      <TimelineChart
        ariaLabel="Empty traffic"
        data={[{ date: '2026-07-18', views: null }]}
        series={[{ dataKey: 'views', label: 'Views' }]}
      />
    )

    expect(markup).toContain('data-slot="chart-empty-state"')
    expect(markup).not.toContain('<svg')
  })
})

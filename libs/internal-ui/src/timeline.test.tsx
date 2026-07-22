import { describe, expect, test } from 'bun:test'
import { renderToStaticMarkup } from 'react-dom/server'

import {
  Timeline,
  TimelineConnector,
  TimelineContent,
  TimelineIndicator,
  TimelineItem,
  TimelineTitle,
} from './timeline'

describe('Timeline', () => {
  test('renders semantic items and status styling hooks', () => {
    const markup = renderToStaticMarkup(
      <Timeline aria-label="Workflow history">
        <TimelineItem status="complete">
          <TimelineIndicator />
          <TimelineConnector />
          <TimelineContent>
            <TimelineTitle>Capture posting</TimelineTitle>
          </TimelineContent>
        </TimelineItem>
        <TimelineItem status="active">
          <TimelineIndicator />
          <TimelineContent>
            <TimelineTitle>Analyze role</TimelineTitle>
          </TimelineContent>
        </TimelineItem>
      </Timeline>
    )

    expect(markup).toContain('<ol')
    expect(markup).toContain('aria-label="Workflow history"')
    expect(markup).toContain('data-state="complete"')
    expect(markup).toContain('data-state="active"')
    expect(markup).toContain('data-slot="timeline-connector"')
  })
})

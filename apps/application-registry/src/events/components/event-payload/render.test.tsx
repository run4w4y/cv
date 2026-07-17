import { afterEach, describe, expect, test } from 'bun:test'
import { cleanup, render } from '@testing-library/react'

import { EventPayload, eventPayloadSummary } from './render'

afterEach(cleanup)

describe('EventPayload', () => {
  test('formats payload fields as readable wrapped text', () => {
    expect(eventPayloadSummary({ from: 'backlog', to: 'interviewing' })).toBe(
      'From: backlog · To: interviewing'
    )

    const view = render(
      <EventPayload payload={{ note: 'A long event explanation' }} />
    )
    expect(
      view.getByText('Note: A long event explanation').className
    ).toContain('break-words')
  })

  test('renders an intentional empty-payload label', () => {
    expect(eventPayloadSummary({})).toBe('No additional details')
  })
})

import { afterEach, describe, expect, test } from 'bun:test'
import { cleanup, render, within } from '@testing-library/react'

import type { RegistryEventListItem } from '@cv/application-registry-api-contract'
import { ApplicationEventsTable } from './render'

afterEach(cleanup)

const event: RegistryEventListItem = {
  id: 'event-1',
  applicationId: 'application-1',
  kind: 'stage_changed',
  revision: 9,
  occurredAt: '2026-07-16T09:30:00.000Z',
  recordedAt: '2026-07-16T09:31:00.000Z',
  payload: { nextStatus: 'technical_screen' },
  operationId: 'operation-1',
  deviceId: null,
  canonicalUrl: 'https://example.test/jobs/one',
  company: 'Example',
  role: 'Staff Engineer',
}

describe('ApplicationEventsTable', () => {
  test('renders a compact application-scoped event history', () => {
    const view = render(<ApplicationEventsTable events={[event]} />)
    const table = view.getByRole('table')

    expect(within(table).getAllByRole('columnheader')).toHaveLength(4)
    expect(view.getByText('Related events')).toBeTruthy()
    expect(view.getByText('Stage changed')).toBeTruthy()
    expect(view.getByText('#9')).toBeTruthy()
    expect(
      view.container
        .querySelector('[data-slot="application-events-table"]')
        ?.classList.contains('max-h-80')
    ).toBe(true)
  })
})

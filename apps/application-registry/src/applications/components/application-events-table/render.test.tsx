import { afterEach, describe, expect, test } from 'bun:test'
import type { ApplicationActivity } from '@cv/application-registry-entity'
import { cleanup, render, within } from '@testing-library/react'
import { ApplicationActivitiesTable } from './render'

afterEach(cleanup)

const activity: ApplicationActivity = {
  actor: 'system',
  applicationId: 'application-1',
  id: 'activity-1',
  kind: 'status_changed',
  occurredAt: '2026-07-16T09:30:00.000Z',
  payload: { nextStatus: 'technical_screen' },
  revision: 9,
  source: 'management',
}

describe('ApplicationActivitiesTable', () => {
  test('renders read-only application activity history', () => {
    const view = render(<ApplicationActivitiesTable activities={[activity]} />)
    expect(
      within(view.getByRole('table')).getAllByRole('columnheader')
    ).toHaveLength(4)
    expect(view.getByText('Related activities')).toBeTruthy()
    expect(view.getByText('Status changed')).toBeTruthy()
    expect(view.getByText('#9')).toBeTruthy()
  })
})

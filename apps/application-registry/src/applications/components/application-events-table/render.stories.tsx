import type { ApplicationActivity } from '@cv/application-registry-entity'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { ApplicationActivitiesTable } from './render'

const activities: readonly ApplicationActivity[] = [
  {
    actor: 'system',
    applicationId: 'application-1',
    id: 'activity-1',
    kind: 'status_changed',
    occurredAt: '2026-07-16T09:30:00.000Z',
    payload: { nextStatus: 'technical_screen' },
    revision: 12,
    source: 'management',
  },
]

const meta = {
  title: 'Application Registry/Related activities',
  component: ApplicationActivitiesTable,
  args: { activities },
} satisfies Meta<typeof ApplicationActivitiesTable>

export default meta
type Story = StoryObj<typeof meta>
export const Default: Story = {}
export const Loading: Story = { args: { activities: undefined } }

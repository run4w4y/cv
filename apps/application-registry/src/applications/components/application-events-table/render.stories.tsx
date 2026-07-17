import type { RegistryEventListItem } from '@cv/application-registry-api-contract'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { ApplicationEventsTable } from './render'

const events: readonly RegistryEventListItem[] = [
  {
    id: 'event-2',
    applicationId: 'application-1',
    kind: 'interview_scheduled',
    revision: 12,
    occurredAt: '2026-07-16T09:30:00.000Z',
    recordedAt: '2026-07-16T09:31:00.000Z',
    payload: { nextStatus: 'technical_screen', interviewer: 'Platform team' },
    operationId: 'operation-2',
    deviceId: null,
    canonicalUrl: 'https://example.test/jobs/one',
    company: 'Example Systems',
    role: 'Staff Platform Engineer',
  },
  {
    id: 'event-1',
    applicationId: 'application-1',
    kind: 'submitted',
    revision: 9,
    occurredAt: '2026-07-10T09:30:00.000Z',
    recordedAt: '2026-07-10T09:31:00.000Z',
    payload: { source: 'application_registry' },
    operationId: 'operation-1',
    deviceId: null,
    canonicalUrl: 'https://example.test/jobs/one',
    company: 'Example Systems',
    role: 'Staff Platform Engineer',
  },
]

const meta = {
  title: 'Application Registry/Related events',
  component: ApplicationEventsTable,
  args: { events },
  decorators: [
    (Story) => (
      <div className="mx-auto max-w-6xl p-6">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof ApplicationEventsTable>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const Loading: Story = { args: { events: undefined } }

import {
  applicationStatusValues,
  listingAvailabilityValues,
} from '@cv/application-registry-entity'
import type { Meta, StoryObj } from '@storybook/react-vite'

import { StatusBadge } from './render'

const meta = {
  title: 'Application Registry/Status badge',
  component: StatusBadge,
  tags: ['autodocs'],
  args: { value: 'applied' },
} satisfies Meta<typeof StatusBadge>

export default meta
type Story = StoryObj<typeof meta>

export const Applied: Story = {}
export const SuspectedClosed: Story = {
  args: { value: 'suspected_closed' },
}
export const AllStatuses: Story = {
  render: () => (
    <div className="flex max-w-xl flex-wrap gap-2">
      {[...applicationStatusValues, ...listingAvailabilityValues].map(
        (value) => (
          <StatusBadge key={value} value={value} />
        )
      )}
    </div>
  ),
}

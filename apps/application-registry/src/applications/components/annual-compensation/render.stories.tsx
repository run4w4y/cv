import type { Meta, StoryObj } from '@storybook/react-vite'

import { AnnualCompensation } from './render'

const meta = {
  title: 'Application Registry/Annual compensation',
  component: AnnualCompensation,
  tags: ['autodocs'],
  args: {
    value: {
      currencyCode: 'USD',
      minimumMinor: 15_000_000,
      maximumMinor: 18_000_000,
    },
  },
} satisfies Meta<typeof AnnualCompensation>

export default meta
type Story = StoryObj<typeof meta>

export const Range: Story = {}
export const OpenEnded: Story = {
  args: {
    value: {
      currencyCode: 'EUR',
      minimumMinor: 12_000_000,
      maximumMinor: null,
    },
  },
}
export const NotProvided: Story = { args: { value: null } }

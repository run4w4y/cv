import type { Meta, StoryObj } from '@storybook/react-vite'

import { Button } from './button'
import { Spinner } from './spinner'

const meta = {
  title: 'Feedback/Spinner',
  component: Spinner,
  tags: ['autodocs'],
} satisfies Meta<typeof Spinner>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const Sizes: Story = {
  render: () => (
    <div className="flex items-center gap-6">
      <Spinner className="size-3" aria-label="Loading compact result" />
      <Spinner aria-label="Loading result" />
      <Spinner className="size-6" aria-label="Loading detailed result" />
    </div>
  ),
}

export const InButton: Story = {
  render: () => (
    <Button disabled>
      <Spinner aria-hidden="true" />
      Starting jobs…
    </Button>
  ),
}

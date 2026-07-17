import type { Meta, StoryObj } from '@storybook/react-vite'

import { Label } from './label'
import { Textarea } from './textarea'

const meta = {
  title: 'Forms/Textarea',
  component: Textarea,
  tags: ['autodocs'],
  args: {
    placeholder: 'Add an internal note…',
  },
} satisfies Meta<typeof Textarea>

export default meta
type Story = StoryObj<typeof meta>

export const Playground: Story = {
  render: (args) => (
    <div className="grid w-md gap-2">
      <Label htmlFor="note">Internal note</Label>
      <Textarea id="note" {...args} />
    </div>
  ),
}

export const Invalid: Story = {
  args: {
    'aria-invalid': true,
    value: 'This note needs attention.',
  },
}

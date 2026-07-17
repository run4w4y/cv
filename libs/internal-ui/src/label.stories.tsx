import type { Meta, StoryObj } from '@storybook/react-vite'

import { Input } from './input'
import { Label } from './label'

const meta = {
  title: 'Forms/Label',
  component: Label,
  tags: ['autodocs'],
} satisfies Meta<typeof Label>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  render: () => (
    <div className="grid w-sm gap-2">
      <Label htmlFor="role">Role</Label>
      <Input id="role" defaultValue="Senior frontend engineer" />
    </div>
  ),
}

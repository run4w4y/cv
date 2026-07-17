import type { Meta, StoryObj } from '@storybook/react-vite'

import { Label } from './label'
import { Switch } from './switch'

const meta = {
  title: 'Forms/Switch',
  component: Switch,
  tags: ['autodocs'],
} satisfies Meta<typeof Switch>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  render: () => (
    <div className="flex items-center gap-2">
      <Switch id="notifications" defaultChecked />
      <Label htmlFor="notifications">Listing notifications</Label>
    </div>
  ),
}

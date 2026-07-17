import type { Meta, StoryObj } from '@storybook/react-vite'

import { Input } from './input'
import { Label } from './label'

const meta = {
  title: 'Forms/Input',
  component: Input,
  tags: ['autodocs'],
  args: {
    placeholder: 'Search applications…',
  },
} satisfies Meta<typeof Input>

export default meta
type Story = StoryObj<typeof meta>

export const Playground: Story = {}

export const WithLabel: Story = {
  render: () => (
    <div className="grid w-sm gap-2">
      <Label htmlFor="company">Company</Label>
      <Input id="company" placeholder="Acme" />
    </div>
  ),
}

export const Disabled: Story = {
  args: {
    disabled: true,
    value: 'Unavailable',
  },
}

export const Invalid: Story = {
  args: {
    'aria-invalid': true,
    value: 'Invalid value',
  },
}

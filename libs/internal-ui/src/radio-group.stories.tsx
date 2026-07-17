import type { Meta, StoryObj } from '@storybook/react-vite'

import { Label } from './label'
import { RadioGroup, RadioGroupItem } from './radio-group'

const meta = {
  title: 'Forms/Radio Group',
  component: RadioGroup<string>,
  tags: ['autodocs'],
} satisfies Meta<typeof RadioGroup<string>>

export default meta
type Story = StoryObj<typeof meta>

export const Priority: Story = {
  render: () => (
    <RadioGroup defaultValue="medium" className="w-sm">
      {['low', 'medium', 'high'].map((priority) => (
        <div key={priority} className="flex items-center gap-2">
          <RadioGroupItem id={`priority-${priority}`} value={priority} />
          <Label htmlFor={`priority-${priority}`} className="capitalize">
            {priority}
          </Label>
        </div>
      ))}
    </RadioGroup>
  ),
}

import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'

import { Combobox } from './combobox'
import { Label } from './label'

const options = [
  {
    value: 'preparing',
    label: 'Preparing application',
    description: 'Materials are still being assembled.',
  },
  {
    value: 'applied',
    label: 'Applied',
    description: 'The application has been submitted.',
  },
  {
    value: 'interviewing',
    label: 'Interviewing',
    description: 'One or more interviews are scheduled.',
  },
  { value: 'offer', label: 'Offer' },
  { value: 'rejected', label: 'Rejected' },
]

const SingleExample = () => {
  const [value, setValue] = useState<string | null>(null)
  return (
    <div className="grid w-80 gap-2">
      <Label>Status</Label>
      <Combobox
        value={value}
        onValueChange={setValue}
        options={options}
        clearable
      />
    </div>
  )
}

const MultipleExample = () => {
  const [value, setValue] = useState<readonly string[]>([
    'preparing',
    'applied',
    'interviewing',
  ])
  return (
    <div className="grid w-80 gap-2">
      <Label>Statuses</Label>
      <Combobox
        mode="multiple"
        value={value}
        onValueChange={setValue}
        options={options}
      />
    </div>
  )
}

const meta = {
  title: 'Forms/Combobox',
  component: Combobox,
  tags: ['autodocs'],
} satisfies Meta<typeof Combobox>

export default meta
type Story = StoryObj<typeof meta>

export const Single: Story = { render: () => <SingleExample /> }
export const Multiple: Story = { render: () => <MultipleExample /> }
export const Invalid: Story = {
  render: () => (
    <div className="w-80">
      <Combobox
        value="applied"
        onValueChange={() => undefined}
        options={options}
        ariaLabel="Invalid application status"
        invalid
      />
    </div>
  ),
}

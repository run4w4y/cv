import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import { Badge } from './badge'
import { Label } from './label'
import { Select } from './select'

const options = [
  { value: 'draft', label: 'Draft' },
  { value: 'applied', label: 'Applied' },
  { value: 'interview', label: 'Interview' },
  { value: 'offer', label: 'Offer' },
  { value: 'rejected', label: 'Rejected' },
]

const StatusSelect = () => {
  const [value, setValue] = useState<string | null>('applied')

  return (
    <div className="grid w-sm gap-2">
      <Label>Status</Label>
      <Select
        value={value}
        onValueChange={setValue}
        options={options}
        ariaLabel="Application status"
      />
    </div>
  )
}

const WrappingSelect = () => {
  const [value, setValue] = useState<string | null>(null)

  return (
    <div className="grid w-56 gap-2">
      <Label>Application source</Label>
      <Select
        value={value}
        onValueChange={setValue}
        options={[
          {
            value: 'referral',
            label:
              'Referred by an existing employee through the internal referral program',
          },
          {
            value: 'outbound',
            label: 'Direct outreach from the recruiting team',
          },
        ]}
        ariaLabel="Application source"
      />
    </div>
  )
}

const meta = {
  title: 'Forms/Select',
  component: Select,
  tags: ['autodocs'],
  args: {
    value: null,
    onValueChange: () => undefined,
    options,
  },
} satisfies Meta<typeof Select>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  render: () => <StatusSelect />,
}

export const WrappingOptions: Story = {
  render: () => <WrappingSelect />,
}

export const CustomValue: Story = {
  render: () => (
    <div className="w-56">
      <Select
        value="applied"
        onValueChange={() => undefined}
        options={options}
        ariaLabel="Application status"
        renderValue={(option) =>
          option === undefined ? null : (
            <Badge variant="success">{option.label}</Badge>
          )
        }
      />
    </div>
  ),
}

export const Invalid: Story = {
  render: () => (
    <div className="w-56">
      <Select
        value="applied"
        onValueChange={() => undefined}
        options={options}
        ariaLabel="Invalid application status"
        invalid
      />
    </div>
  ),
}

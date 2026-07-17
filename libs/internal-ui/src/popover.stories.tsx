import type { Meta, StoryObj } from '@storybook/react-vite'
import { Filter } from 'lucide-react'

import { Button } from './button'
import { Popover, PopoverContent, PopoverTrigger } from './popover'

const meta = {
  title: 'Overlays/Popover',
  component: Popover,
  tags: ['autodocs'],
} satisfies Meta<typeof Popover>

export default meta
type Story = StoryObj<typeof meta>

export const AddFilter: Story = {
  render: () => (
    <Popover>
      <PopoverTrigger
        render={
          <Button variant="outline">
            <Filter />
            Add filter
          </Button>
        }
      />
      <PopoverContent align="start">
        <p className="text-sm font-medium">Choose a field</p>
        <div className="mt-2 grid gap-1 text-sm text-muted-foreground">
          <button
            type="button"
            className="rounded-sm p-2 text-left hover:bg-muted"
          >
            Status
          </button>
          <button
            type="button"
            className="rounded-sm p-2 text-left hover:bg-muted"
          >
            Company
          </button>
          <button
            type="button"
            className="rounded-sm p-2 text-left hover:bg-muted"
          >
            Applied date
          </button>
        </div>
      </PopoverContent>
    </Popover>
  ),
}

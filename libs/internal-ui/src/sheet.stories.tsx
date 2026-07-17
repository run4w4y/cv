import type { Meta, StoryObj } from '@storybook/react-vite'

import { Button } from './button'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from './sheet'

const meta = {
  title: 'Overlays/Sheet',
  component: Sheet,
  tags: ['autodocs'],
} satisfies Meta<typeof Sheet>

export default meta
type Story = StoryObj<typeof meta>

export const Filters: Story = {
  render: () => (
    <Sheet>
      <SheetTrigger render={<Button variant="outline">Open filters</Button>} />
      <SheetContent side="right">
        <SheetHeader>
          <SheetTitle>Application filters</SheetTitle>
          <SheetDescription>
            Narrow the registry using status, priority, and date fields.
          </SheetDescription>
        </SheetHeader>
        <div className="grid gap-3 text-sm">
          <div className="rounded-md border border-border p-3">
            Status filter
          </div>
          <div className="rounded-md border border-border p-3">
            Priority filter
          </div>
        </div>
      </SheetContent>
    </Sheet>
  ),
}

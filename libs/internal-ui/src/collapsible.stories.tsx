import type { Meta, StoryObj } from '@storybook/react-vite'
import { ChevronDown } from 'lucide-react'

import { Button } from './button'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from './collapsible'

const meta = {
  title: 'Disclosure/Collapsible',
  component: Collapsible,
  tags: ['autodocs'],
} satisfies Meta<typeof Collapsible>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  render: () => (
    <Collapsible className="w-md rounded-md border border-border bg-card">
      <CollapsibleTrigger
        render={<Button variant="ghost" className="w-full justify-between" />}
      >
        Advanced generation settings
        <ChevronDown className="transition-transform data-open:rotate-180" />
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="border-t border-border p-4 text-sm/6 text-muted-foreground">
          The batch will reuse the active facts release and the selected model
          configuration for every job.
        </div>
      </CollapsibleContent>
    </Collapsible>
  ),
}

export const Open: Story = {
  render: () => (
    <Collapsible
      defaultOpen
      className="w-md rounded-md border border-border bg-card"
    >
      <CollapsibleTrigger className="flex w-full cursor-pointer items-center justify-between rounded-md px-4 py-3 text-sm font-medium">
        Source context
        <ChevronDown className="size-4 transition-transform data-open:rotate-180" />
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="border-t border-border p-4 text-sm/6 text-muted-foreground">
          Captured from the canonical application URL 3 minutes ago.
        </div>
      </CollapsibleContent>
    </Collapsible>
  ),
}

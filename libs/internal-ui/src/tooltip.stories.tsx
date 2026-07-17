import type { Meta, StoryObj } from '@storybook/react-vite'
import { Settings } from 'lucide-react'

import { Button } from './button'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from './tooltip'

const meta = {
  title: 'Overlays/Tooltip',
  component: Tooltip,
  tags: ['autodocs'],
} satisfies Meta<typeof Tooltip>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  render: () => (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger
          render={
            <Button size="icon" variant="outline" aria-label="Table settings">
              <Settings />
            </Button>
          }
        />
        <TooltipContent>Table settings</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  ),
}

import type { Meta, StoryObj } from '@storybook/react-vite'
import { Settings2 } from 'lucide-react'
import { useState } from 'react'

import { Button } from './button'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './dropdown-menu'

const MenuExample = () => {
  const [showCompany, setShowCompany] = useState(true)
  const [showStatus, setShowStatus] = useState(true)

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="outline">
            <Settings2 />
            View
          </Button>
        }
      />
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>Table density</DropdownMenuLabel>
        <DropdownMenuItem>Compact</DropdownMenuItem>
        <DropdownMenuItem>Comfortable</DropdownMenuItem>
        <DropdownMenuItem>Spacious</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuLabel>Columns</DropdownMenuLabel>
        <DropdownMenuCheckboxItem
          checked={showCompany}
          onCheckedChange={setShowCompany}
        >
          Company
        </DropdownMenuCheckboxItem>
        <DropdownMenuCheckboxItem
          checked={showStatus}
          onCheckedChange={setShowStatus}
        >
          Status
        </DropdownMenuCheckboxItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

const meta = {
  title: 'Overlays/Dropdown Menu',
  component: DropdownMenu,
  tags: ['autodocs'],
} satisfies Meta<typeof DropdownMenu>

export default meta
type Story = StoryObj<typeof meta>

export const TableSettings: Story = {
  render: () => <MenuExample />,
}

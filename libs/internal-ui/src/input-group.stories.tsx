import type { Meta, StoryObj } from '@storybook/react-vite'
import { Search, X } from 'lucide-react'

import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
  InputGroupTextarea,
} from './input-group'

const meta = {
  title: 'Forms/Input Group',
  component: InputGroup,
  tags: ['autodocs'],
} satisfies Meta<typeof InputGroup>

export default meta
type Story = StoryObj<typeof meta>

export const SearchField: Story = {
  render: () => (
    <InputGroup className="w-md">
      <InputGroupAddon>
        <Search />
      </InputGroupAddon>
      <InputGroupInput aria-label="Search" placeholder="Search applications…" />
      <InputGroupButton aria-label="Clear search">
        <X />
      </InputGroupButton>
    </InputGroup>
  ),
}

export const NoteComposer: Story = {
  render: () => (
    <InputGroup className="w-md">
      <InputGroupTextarea
        aria-label="Note"
        placeholder="Add an internal note…"
      />
      <InputGroupAddon className="items-end py-2">Markdown</InputGroupAddon>
    </InputGroup>
  ),
}

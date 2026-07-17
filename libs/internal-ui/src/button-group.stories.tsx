import type { Meta, StoryObj } from '@storybook/react-vite'

import { Button } from './button'
import {
  ButtonGroup,
  ButtonGroupSeparator,
  ButtonGroupText,
} from './button-group'

const meta = {
  title: 'Actions/Button Group',
  component: ButtonGroup,
  tags: ['autodocs'],
} satisfies Meta<typeof ButtonGroup>

export default meta
type Story = StoryObj<typeof meta>

export const ViewSwitcher: Story = {
  render: () => (
    <ButtonGroup>
      <Button variant="outline">List</Button>
      <Button variant="outline">Board</Button>
      <Button variant="outline">Timeline</Button>
    </ButtonGroup>
  ),
}

export const WithText: Story = {
  render: () => (
    <ButtonGroup>
      <ButtonGroupText>3 selected</ButtonGroupText>
      <ButtonGroupSeparator />
      <Button variant="outline">Archive</Button>
      <ButtonGroupSeparator />
      <Button variant="destructive">Delete</Button>
    </ButtonGroup>
  ),
}

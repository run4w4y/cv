import type { Meta, StoryObj } from '@storybook/react-vite'
import { Building2 } from 'lucide-react'

import { Badge } from './badge'
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemMedia,
  ItemTitle,
} from './item'

const meta = {
  title: 'Data Display/Item',
  component: Item,
  tags: ['autodocs'],
} satisfies Meta<typeof Item>

export default meta
type Story = StoryObj<typeof meta>

export const ApplicationList: Story = {
  render: () => (
    <ItemGroup className="w-xl">
      <Item variant="outline">
        <ItemMedia>
          <Building2 />
        </ItemMedia>
        <ItemContent>
          <ItemTitle>Acme · Senior frontend engineer</ItemTitle>
          <ItemDescription>Remote · Applied July 14</ItemDescription>
        </ItemContent>
        <ItemActions>
          <Badge variant="warning">Interview</Badge>
        </ItemActions>
      </Item>
      <Item variant="outline">
        <ItemMedia>
          <Building2 />
        </ItemMedia>
        <ItemContent>
          <ItemTitle>Northstar · Platform engineer</ItemTitle>
          <ItemDescription>Berlin · Applied July 9</ItemDescription>
        </ItemContent>
        <ItemActions>
          <Badge>Applied</Badge>
        </ItemActions>
      </Item>
    </ItemGroup>
  ),
}

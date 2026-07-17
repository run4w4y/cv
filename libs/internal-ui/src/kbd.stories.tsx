import type { Meta, StoryObj } from '@storybook/react-vite'

import { Kbd, KbdGroup } from './kbd'

const meta = {
  title: 'Data Display/Keyboard Key',
  component: Kbd,
  tags: ['autodocs'],
} satisfies Meta<typeof Kbd>

export default meta
type Story = StoryObj<typeof meta>

export const Shortcut: Story = {
  render: () => (
    <div className="flex items-center gap-3 text-sm text-muted-foreground">
      <span>Open command menu</span>
      <KbdGroup>
        <Kbd>Ctrl</Kbd>
        <span>+</span>
        <Kbd>K</Kbd>
      </KbdGroup>
    </div>
  ),
}

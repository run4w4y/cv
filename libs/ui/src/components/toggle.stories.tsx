import type { Meta, StoryObj } from '@storybook/react-vite'

import { Toggle } from './toggle'

const meta = {
  title: 'Components/Toggle',
  component: Toggle,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'Toggle wraps Base UI toggle state with shared button-like variants.',
      },
    },
  },
  argTypes: {
    variant: {
      control: 'select',
      options: ['default', 'outline', 'toolbar'],
    },
    size: {
      control: 'select',
      options: ['default', 'sm', 'lg', 'toolbar'],
    },
  },
  args: {
    children: 'Public',
    size: 'default',
    variant: 'default',
  },
} satisfies Meta<typeof Toggle>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const Pressed: Story = {
  args: {
    children: 'Selected',
    defaultPressed: true,
  },
}

export const Variants: Story = {
  render: () => (
    <div className="flex flex-wrap items-center gap-3">
      <Toggle defaultPressed>Default</Toggle>
      <Toggle variant="outline" defaultPressed>
        Outline
      </Toggle>
      <Toggle
        variant="toolbar"
        size="toolbar"
        defaultPressed
        aria-label="Pinned"
      >
        P
      </Toggle>
    </div>
  ),
}

export const Disabled: Story = {
  args: {
    children: 'Locked',
    disabled: true,
  },
}

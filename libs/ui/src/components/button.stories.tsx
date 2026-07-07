import type { Meta, StoryObj } from '@storybook/react-vite'

import { Button } from './button'

const meta = {
  title: 'Components/Button',
  component: Button,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'Button wraps Base UI button primitives with shared variants and sizes.',
      },
    },
  },
  argTypes: {
    variant: {
      control: 'select',
      options: [
        'default',
        'outline',
        'secondary',
        'ghost',
        'destructive',
        'link',
        'toolbar',
        'toolbar-active',
        'toolbar-primary',
      ],
    },
    size: {
      control: 'select',
      options: [
        'default',
        'xs',
        'sm',
        'lg',
        'icon',
        'icon-xs',
        'icon-sm',
        'icon-lg',
        'toolbar',
        'toolbar-tab',
      ],
    },
  },
  args: {
    children: 'Download CV',
    size: 'default',
    variant: 'default',
  },
} satisfies Meta<typeof Button>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const Variants: Story = {
  render: () => (
    <div className="flex flex-wrap items-center gap-3">
      <Button>Default</Button>
      <Button variant="outline">Outline</Button>
      <Button variant="secondary">Secondary</Button>
      <Button variant="ghost">Ghost</Button>
      <Button variant="destructive">Destructive</Button>
      <Button variant="link">Link</Button>
    </div>
  ),
}

export const Sizes: Story = {
  render: () => (
    <div className="flex flex-wrap items-center gap-3">
      <Button size="xs">Extra small</Button>
      <Button size="sm">Small</Button>
      <Button>Default</Button>
      <Button size="lg">Large</Button>
      <Button size="icon" aria-label="Add item">
        +
      </Button>
    </div>
  ),
}

export const Navigation: Story = {
  render: () => (
    <div className="flex flex-wrap items-center">
      <Button variant="toolbar-active" size="toolbar-tab">
        Summary
      </Button>
      <Button variant="toolbar" size="toolbar-tab">
        Experience
      </Button>
      <Button variant="toolbar" size="toolbar-tab">
        Skills
      </Button>
      <Button variant="toolbar-primary" size="toolbar">
        Export PDF
      </Button>
    </div>
  ),
}

export const Disabled: Story = {
  args: {
    children: 'Unavailable',
    disabled: true,
  },
}

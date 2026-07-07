import type { Meta, StoryObj } from '@storybook/react-vite'

import { ToggleGroup, ToggleGroupItem } from './toggle-group'

const meta = {
  title: 'Components/ToggleGroup',
  component: ToggleGroup,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'ToggleGroup provides single- or multi-select grouped toggles with shared spacing, orientation, size, and variant context.',
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
    orientation: {
      control: 'inline-radio',
      options: ['horizontal', 'vertical'],
    },
  },
  args: {
    size: 'default',
    spacing: 0,
    variant: 'outline',
  },
} satisfies Meta<typeof ToggleGroup>

export default meta

type Story = StoryObj<typeof meta>

export const SingleSelect: Story = {
  render: (args) => (
    <ToggleGroup {...args} defaultValue={['pdf']}>
      <ToggleGroupItem value="pdf">PDF</ToggleGroupItem>
      <ToggleGroupItem value="web">Web</ToggleGroupItem>
      <ToggleGroupItem value="print">Print</ToggleGroupItem>
    </ToggleGroup>
  ),
}

export const MultiSelect: Story = {
  render: () => (
    <ToggleGroup
      multiple
      defaultValue={['react', 'nx']}
      variant="default"
      spacing={2}
    >
      <ToggleGroupItem value="react">React</ToggleGroupItem>
      <ToggleGroupItem value="nx">Nx</ToggleGroupItem>
      <ToggleGroupItem value="astro">Astro</ToggleGroupItem>
    </ToggleGroup>
  ),
}

export const Segmented: Story = {
  render: () => (
    <ToggleGroup defaultValue={['en']} variant="toolbar" size="toolbar">
      <ToggleGroupItem value="en" aria-label="English">
        EN
      </ToggleGroupItem>
      <ToggleGroupItem value="ru" aria-label="Russian">
        RU
      </ToggleGroupItem>
      <ToggleGroupItem value="pdf" aria-label="PDF">
        PDF
      </ToggleGroupItem>
    </ToggleGroup>
  ),
}

export const Vertical: Story = {
  render: () => (
    <ToggleGroup
      defaultValue={['compact']}
      orientation="vertical"
      variant="outline"
      className="items-stretch"
    >
      <ToggleGroupItem value="compact">Compact</ToggleGroupItem>
      <ToggleGroupItem value="comfortable">Comfortable</ToggleGroupItem>
      <ToggleGroupItem value="expanded">Expanded</ToggleGroupItem>
    </ToggleGroup>
  ),
}

import type { Meta, StoryObj } from '@storybook/react-vite'

import {
  Field,
  FieldControl,
  FieldDescription,
  FieldError,
  FieldLabel,
} from './field'

const meta = {
  title: 'Forms/Field',
  component: Field,
  tags: ['autodocs'],
} satisfies Meta<typeof Field>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  render: () => (
    <Field className="w-sm" name="company">
      <FieldLabel>Company</FieldLabel>
      <FieldControl placeholder="Acme" />
      <FieldDescription>The organization offering the role.</FieldDescription>
    </Field>
  ),
}

export const Invalid: Story = {
  render: () => (
    <Field className="w-sm" name="listing" invalid>
      <FieldLabel>Listing URL</FieldLabel>
      <FieldControl defaultValue="not-a-url" />
      <FieldError match>Enter a valid URL.</FieldError>
    </Field>
  ),
}

import { Button } from '@cv/internal-ui'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { useForm } from 'react-hook-form'

import {
  Form,
  FormDescription,
  FormField,
  FormInput,
  FormItem,
  FormLabel,
  FormMessage,
  FormSelect,
  FormTextarea,
} from './index'

const Example = () => {
  const form = useForm({
    defaultValues: { company: '', notes: '', status: 'open' },
  })
  return (
    <Form {...form}>
      <form
        className="grid w-96 gap-5"
        onSubmit={form.handleSubmit(() => undefined)}
      >
        <FormField
          control={form.control}
          name="status"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Status</FormLabel>
              <FormSelect
                {...field}
                onValueChange={field.onChange}
                ariaLabel="Status"
                options={[
                  { label: 'Open', value: 'open' },
                  { label: 'Closed', value: 'closed' },
                ]}
              />
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="company"
          rules={{ required: 'Company is required.' }}
          render={({ field }) => (
            <FormItem>
              <FormLabel required>Company</FormLabel>
              <FormInput placeholder="Acme" {...field} />
              <FormDescription>The organization being tracked.</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="notes"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Notes</FormLabel>
              <FormTextarea placeholder="Additional context" {...field} />
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit">Save</Button>
      </form>
    </Form>
  )
}

const meta = {
  title: 'Forms/Form field',
  component: Example,
  tags: ['autodocs'],
} satisfies Meta<typeof Example>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

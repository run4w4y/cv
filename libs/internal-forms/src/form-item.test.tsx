import { afterEach, describe, expect, it } from 'bun:test'
import { act, cleanup, fireEvent, render } from '@testing-library/react'
import * as React from 'react'
import { type UseFormReturn, useForm } from 'react-hook-form'

import {
  Form,
  FormDateTimeInput,
  FormDescription,
  FormField,
  FormInput,
  FormItem,
  FormLabel,
  FormMessage,
  FormSelect,
} from './index'

afterEach(cleanup)

describe('internal form fields', () => {
  it('wires labels, descriptions, and errors to a controlled field', async () => {
    type Values = { readonly company: string }
    const methodsRef = React.createRef<UseFormReturn<Values>>()

    const Harness = React.forwardRef<UseFormReturn<Values>>((_, ref) => {
      const methods = useForm<Values>({ defaultValues: { company: '' } })
      React.useImperativeHandle(ref, () => methods, [methods])
      return (
        <Form {...methods}>
          <FormField
            control={methods.control}
            name="company"
            render={({ field }) => (
              <FormItem>
                <FormLabel required>Company</FormLabel>
                <FormInput placeholder="Company" {...field} />
                <FormDescription>Legal or trading name.</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </Form>
      )
    })
    Harness.displayName = 'Harness'

    const view = render(<Harness ref={methodsRef} />)
    await act(async () => {
      methodsRef.current?.setError('company', {
        type: 'manual',
        message: 'Company is required.',
      })
    })

    const input = view.getByPlaceholderText('Company')
    const label = view.getByText('Company')
    expect(input.getAttribute('aria-invalid')).toBe('true')
    expect(input.getAttribute('aria-labelledby')).toBe(label.id)
    expect(label.classList.contains('data-[error=true]:text-destructive')).toBe(
      true
    )
    expect(view.getByText('Company is required.')).toBeTruthy()
    expect(view.getByText('Legal or trading name.')).toBeTruthy()

    fireEvent.click(label)
    expect(document.activeElement).toBe(input)
  })

  it('wires non-input controls into the same label and error context', async () => {
    type Values = { readonly status: string }
    const methodsRef = React.createRef<UseFormReturn<Values>>()

    const Harness = React.forwardRef<UseFormReturn<Values>>((_, ref) => {
      const methods = useForm<Values>({ defaultValues: { status: 'open' } })
      React.useImperativeHandle(ref, () => methods, [methods])
      return (
        <Form {...methods}>
          <FormField
            control={methods.control}
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
                <FormDescription>Current workflow state.</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </Form>
      )
    })
    Harness.displayName = 'SelectHarness'

    const view = render(<Harness ref={methodsRef} />)
    await act(async () => {
      methodsRef.current?.setError('status', {
        type: 'manual',
        message: 'Choose a valid status.',
      })
    })

    const trigger = view.getByRole('combobox', { name: 'Status' })
    const label = view.getByText('Status')
    expect(label.getAttribute('for')).toBeNull()
    expect(trigger.getAttribute('aria-labelledby')).toBe(label.id)
    expect(trigger.getAttribute('aria-invalid')).toBe('true')
    expect(trigger.getAttribute('aria-describedby')).toContain('-message')
    expect(view.getByText('Choose a valid status.')).toBeTruthy()
  })

  it('labels and focuses a segmented date-time field without targeting its group with htmlFor', () => {
    type Values = { readonly scheduledAt?: Date }

    const Harness = () => {
      const methods = useForm<Values>({
        defaultValues: { scheduledAt: undefined },
      })
      return (
        <Form {...methods}>
          <FormField
            control={methods.control}
            name="scheduledAt"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Interview time</FormLabel>
                <FormDateTimeInput {...field} />
              </FormItem>
            )}
          />
        </Form>
      )
    }

    const view = render(<Harness />)
    const label = view.getByText('Interview time')
    const group = view.getByRole('group', { name: 'Interview time' })

    expect(label.getAttribute('for')).toBeNull()
    expect(group.getAttribute('aria-labelledby')).toBe(label.id)
  })
})

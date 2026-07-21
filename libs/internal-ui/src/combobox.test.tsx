import { afterEach, describe, expect, test } from 'bun:test'
import {
  cleanup,
  fireEvent,
  render,
  waitFor,
  within,
} from '@testing-library/react'
import * as React from 'react'

import { Combobox, filterComboboxOptions } from './combobox'

const options = [
  { value: 'preparing', label: 'Preparing', keywords: ['draft'] },
  { value: 'interviewing', label: 'Interviewing' },
] as const

afterEach(() => cleanup())

describe('filterComboboxOptions', () => {
  test('matches labels, values, and supplied keywords without case sensitivity', () => {
    expect(filterComboboxOptions(options, 'INTERVIEW')).toEqual([options[1]])
    expect(filterComboboxOptions(options, 'draft')).toEqual([options[0]])
  })

  test('returns every option for an empty search', () => {
    expect(filterComboboxOptions(options, '  ')).toEqual(options)
  })
})

describe('Combobox', () => {
  test('exposes combobox semantics and selects a filtered option with the keyboard', async () => {
    const Harness = () => {
      const [value, setValue] = React.useState<string | null>(null)
      return (
        <Combobox
          ariaLabel="Application status"
          searchPlaceholder="Search statuses"
          value={value}
          onValueChange={setValue}
          options={options}
        />
      )
    }

    const view = render(<Harness />)
    const trigger = view.getByRole('combobox', {
      name: 'Application status',
    })

    expect(trigger.getAttribute('aria-haspopup')).toBe('listbox')
    fireEvent.keyDown(trigger, { key: 'ArrowDown' })

    const input = await view.findByLabelText('Search statuses')
    fireEvent.change(input, { target: { value: 'interview' } })
    fireEvent.keyDown(input, { key: 'ArrowDown' })
    fireEvent.keyDown(input, { key: 'Enter' })

    await waitFor(() => {
      expect(within(trigger).getByText('Interviewing')).toBeTruthy()
    })
  })

  test('renders selected multiple values as badges in the closed trigger', () => {
    const view = render(
      <Combobox
        mode="multiple"
        ariaLabel="Application statuses"
        value={['preparing', 'interviewing']}
        onValueChange={() => undefined}
        options={options}
      />
    )
    const trigger = view.getByRole('combobox', {
      name: 'Application statuses',
    })

    expect(within(trigger).getByText('Preparing')).toBeTruthy()
    expect(within(trigger).getByText('Interviewing')).toBeTruthy()
    expect(within(trigger).queryByText('2 selected')).toBeNull()
  })

  test('only applies empty-state spacing when no options match', async () => {
    const view = render(
      <Combobox
        ariaLabel="Application status"
        searchPlaceholder="Search statuses"
        value={null}
        onValueChange={() => undefined}
        options={options}
      />
    )

    fireEvent.click(view.getByRole('combobox', { name: 'Application status' }))

    const input = await view.findByLabelText('Search statuses')
    const emptyRegion = view.getByRole('status')

    expect(emptyRegion.textContent).toBe('')
    expect(emptyRegion.classList.contains('py-6')).toBe(false)
    expect(emptyRegion.children).toHaveLength(0)

    fireEvent.change(input, { target: { value: 'missing' } })

    await waitFor(() => {
      const emptyMessage = within(emptyRegion).getByText('No options found.')
      expect(emptyMessage.classList.contains('py-6')).toBe(true)
    })
  })

  test('owns its form value at the root and renders destructive invalid styling', () => {
    const view = render(
      <>
        <form id="row-editor" />
        <Combobox
          ariaLabel="Application status"
          name="status"
          form="row-editor"
          value="preparing"
          onValueChange={() => undefined}
          options={options}
          invalid
        />
      </>
    )
    const trigger = view.getByRole('combobox', {
      name: 'Application status',
    })
    const hiddenInput = view.container.querySelector<HTMLInputElement>(
      'input[name="status"]'
    )
    const form = view.container.querySelector<HTMLFormElement>('#row-editor')

    expect(trigger.getAttribute('name')).toBeNull()
    expect(trigger.classList.contains('aria-invalid:border-destructive')).toBe(
      true
    )
    expect(trigger.classList.contains('bg-card')).toBe(true)
    expect(hiddenInput?.form).toBe(form)
    expect(form && new FormData(form).get('status')).toBe('preparing')
  })
})

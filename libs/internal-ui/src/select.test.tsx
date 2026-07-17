import { afterEach, describe, expect, test } from 'bun:test'
import { cleanup, render, within } from '@testing-library/react'

import { Badge } from './badge'
import { Select } from './select'

afterEach(cleanup)

describe('Select', () => {
  test('supports a custom closed-trigger value without changing its options', () => {
    const view = render(
      <Select
        ariaLabel="Application target"
        value="apply_next"
        onValueChange={() => undefined}
        options={[{ value: 'apply_next', label: 'Apply next' }]}
        renderValue={(option) =>
          option === undefined ? null : <Badge>{option.label}</Badge>
        }
      />
    )

    const trigger = view.getByRole('combobox', {
      name: 'Application target',
    })
    expect(within(trigger).getByText('Apply next')).toBeTruthy()
    expect(
      within(trigger).getByText('Apply next').closest('[data-slot="badge"]')
    ).toBeTruthy()
  })

  test('supports a quiet in-context trigger variant', () => {
    const view = render(
      <Select
        ariaLabel="Inline status"
        value="applied"
        onValueChange={() => undefined}
        options={[{ value: 'applied', label: 'Applied' }]}
        variant="ghost"
      />
    )

    const trigger = view.getByRole('combobox', { name: 'Inline status' })
    expect(trigger.classList.contains('border-transparent')).toBe(true)
    expect(trigger.classList.contains('bg-transparent')).toBe(true)
  })

  test('owns its form value at the root and renders destructive invalid styling', () => {
    const view = render(
      <>
        <form id="row-editor" />
        <Select
          ariaLabel="Application status"
          name="status"
          form="row-editor"
          value="applied"
          onValueChange={() => undefined}
          options={[{ value: 'applied', label: 'Applied' }]}
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
    expect(form && new FormData(form).get('status')).toBe('applied')
  })
})

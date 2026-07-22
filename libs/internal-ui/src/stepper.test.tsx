import { afterEach, describe, expect, test } from 'bun:test'
import { cleanup, fireEvent, render } from '@testing-library/react'

import {
  Stepper,
  StepperContent,
  StepperIndicator,
  StepperItem,
  StepperList,
  StepperTitle,
  StepperTrigger,
} from './stepper'

afterEach(cleanup)

describe('Stepper', () => {
  test('navigates an uncontrolled stepper and preserves inactive panels', () => {
    const view = render(
      <Stepper defaultValue={1}>
        <StepperList aria-label="Create batch">
          <StepperItem step={1}>
            <StepperTrigger>
              <StepperIndicator />
              <StepperTitle>Add URLs</StepperTitle>
            </StepperTrigger>
          </StepperItem>
          <StepperItem step={2}>
            <StepperTrigger>
              <StepperIndicator />
              <StepperTitle>Configure</StepperTitle>
            </StepperTrigger>
          </StepperItem>
        </StepperList>
        <StepperContent step={1}>URL form</StepperContent>
        <StepperContent step={2}>Configuration form</StepperContent>
      </Stepper>
    )

    const first = view.getByRole('button', { name: 'Add URLs' })
    const second = view.getByRole('button', { name: 'Configure' })
    const firstPanel = view
      .getByText('URL form')
      .closest<HTMLDivElement>('[role="tabpanel"]')

    expect(first.getAttribute('aria-current')).toBe('step')
    expect(firstPanel?.hidden).toBe(false)

    fireEvent.click(second)

    expect(first.getAttribute('aria-current')).toBeNull()
    expect(second.getAttribute('aria-current')).toBe('step')
    expect(
      view.getByText('URL form').closest('[role="tabpanel"]')?.hidden
    ).toBe(true)
    expect(
      view.getByText('Configuration form').closest('[role="tabpanel"]')?.hidden
    ).toBe(false)
  })

  test('does not navigate from a disabled step', () => {
    const view = render(
      <Stepper defaultValue={1}>
        <StepperList>
          <StepperItem step={1}>
            <StepperTrigger>Current</StepperTrigger>
          </StepperItem>
          <StepperItem step={2} disabled>
            <StepperTrigger>Unavailable</StepperTrigger>
          </StepperItem>
        </StepperList>
      </Stepper>
    )

    const current = view.getByRole('button', { name: 'Current' })
    const unavailable = view.getByRole('button', { name: 'Unavailable' })

    fireEvent.click(unavailable)

    expect(unavailable.hasAttribute('disabled')).toBe(true)
    expect(current.getAttribute('aria-current')).toBe('step')
  })
})

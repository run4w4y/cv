import { afterEach, describe, expect, test } from 'bun:test'
import { cleanup, fireEvent, render } from '@testing-library/react'

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from './collapsible'

afterEach(cleanup)

describe('Collapsible', () => {
  test('toggles its accessible content from the trigger', () => {
    const view = render(
      <Collapsible>
        <CollapsibleTrigger>Advanced settings</CollapsibleTrigger>
        <CollapsibleContent>Generation diagnostics</CollapsibleContent>
      </Collapsible>
    )

    const trigger = view.getByRole('button', { name: 'Advanced settings' })
    expect(trigger.getAttribute('aria-expanded')).toBe('false')
    expect(view.queryByText('Generation diagnostics')).toBeNull()

    fireEvent.click(trigger)

    expect(trigger.getAttribute('aria-expanded')).toBe('true')
    expect(view.getByText('Generation diagnostics')).toBeTruthy()
  })
})

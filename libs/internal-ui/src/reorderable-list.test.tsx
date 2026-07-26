import { afterEach, describe, expect, test } from 'bun:test'
import {
  act,
  cleanup,
  fireEvent,
  render,
  waitFor,
} from '@testing-library/react'
import * as React from 'react'

import { ReorderableList } from './reorderable-list'

type Item = {
  readonly id: string
  readonly label: string
}

const initialItems: ReadonlyArray<Item> = [
  { id: 'alpha', label: 'Alpha' },
  { id: 'beta', label: 'Beta' },
  { id: 'gamma', label: 'Gamma' },
]

const ReorderHarness = ({
  disabled = false,
}: {
  readonly disabled?: boolean
}) => {
  const [items, setItems] = React.useState(initialItems)

  return (
    <ReorderableList
      ariaLabel="Reorder entries"
      disabled={disabled}
      getKey={(item) => item.id}
      getTextValue={(item) => item.label}
      items={items}
      onMove={(fromIndex, toIndex) => {
        setItems((current) => {
          const next = [...current]
          const [moved] = next.splice(fromIndex, 1)
          if (moved !== undefined) next.splice(toIndex, 0, moved)
          return next
        })
      }}
      renderItem={(item) => <span>{item.label}</span>}
    />
  )
}

afterEach(cleanup)

describe('ReorderableList', () => {
  test('exposes one named drag affordance for every row', () => {
    const view = render(<ReorderHarness />)

    expect(view.getByRole('grid', { name: 'Reorder entries' })).toBeTruthy()
    expect(view.getAllByRole('row')).toHaveLength(3)
    expect(view.getByRole('button', { name: 'Drag Alpha' })).toBeTruthy()
    expect(view.getByRole('button', { name: 'Drag Beta' })).toBeTruthy()
    expect(view.getByRole('button', { name: 'Drag Gamma' })).toBeTruthy()
  })

  test('supports reordering from the keyboard drag affordance', async () => {
    const view = render(<ReorderHarness />)
    const dragAlpha = view.getByRole('button', { name: 'Drag Alpha' })

    await act(async () => {
      dragAlpha.focus()
      fireEvent.keyDown(dragAlpha, { code: 'Enter', key: 'Enter' })
      fireEvent.keyUp(dragAlpha, { code: 'Enter', key: 'Enter' })
    })

    await waitFor(() =>
      expect(document.activeElement?.getAttribute('aria-label')).toBe(
        'Insert between Alpha and Beta'
      )
    )
    await act(async () => {
      const currentTarget = document.activeElement
      if (currentTarget === null) throw new Error('Expected a drop target.')
      fireEvent.keyDown(currentTarget, {
        code: 'ArrowDown',
        key: 'ArrowDown',
      })
    })
    await waitFor(() =>
      expect(document.activeElement?.getAttribute('aria-label')).toBe(
        'Insert between Beta and Gamma'
      )
    )
    await act(async () => {
      const currentTarget = document.activeElement
      if (currentTarget === null) throw new Error('Expected a drop target.')
      fireEvent.keyDown(currentTarget, { code: 'Enter', key: 'Enter' })
      fireEvent.keyUp(currentTarget, { code: 'Enter', key: 'Enter' })
    })

    expect(
      view
        .getAllByRole('row')
        .filter((row) => row.textContent?.trim())
        .map((row) => row.textContent?.trim())
    ).toEqual(['Beta', 'Alpha', 'Gamma'])
  })

  test('disables every drag affordance when reordering is unavailable', () => {
    const view = render(<ReorderHarness disabled />)

    for (const handle of view.getAllByRole('button', { name: /^Drag / })) {
      expect(handle.hasAttribute('disabled')).toBe(true)
    }
  })
})

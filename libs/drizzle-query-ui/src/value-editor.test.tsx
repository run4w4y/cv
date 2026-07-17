import { afterEach, describe, expect, test } from 'bun:test'
import { cleanup, fireEvent, render } from '@testing-library/react'
import * as React from 'react'

afterEach(() => cleanup())

describe('ValueEditor', () => {
  test('updates a boolean value through the descriptor-driven checkbox', async () => {
    const { ValueEditor } = await import('./value-editor')

    const Harness = () => {
      const [value, setValue] = React.useState<unknown>(false)
      return (
        <>
          <ValueEditor
            descriptor={{ type: 'boolean' }}
            value={value}
            onChange={setValue}
            options={[]}
            ariaLabel="Active value"
          />
          <output>{String(value)}</output>
        </>
      )
    }

    const view = render(<Harness />)
    fireEvent.click(view.getByRole('checkbox', { name: 'Active value' }))

    expect(view.getByText('True')).toBeTruthy()
    expect(view.getByText('true', { selector: 'output' })).toBeTruthy()
  })

  test('maps array option selections without losing existing values', async () => {
    const { ValueEditor } = await import('./value-editor')

    const Harness = () => {
      const [value, setValue] = React.useState<unknown>(['remote'])
      return (
        <>
          <ValueEditor
            descriptor={{ type: 'array', item: { type: 'string' } }}
            value={value}
            onChange={setValue}
            options={[
              { label: 'Remote', value: 'remote' },
              { label: 'Platform', value: 'platform' },
            ]}
            ariaLabel="Labels value"
          />
          <output>{JSON.stringify(value)}</output>
        </>
      )
    }

    const view = render(<Harness />)
    fireEvent.click(view.getByRole('combobox', { name: 'Labels value' }))
    fireEvent.click(await view.findByRole('option', { name: 'Platform' }))

    expect(view.getByText('["remote","platform"]')).toBeTruthy()
  })

  test('parses numeric and boolean array operands to their descriptor types', async () => {
    const { ValueEditor } = await import('./value-editor')

    const Harness = () => {
      const [numbers, setNumbers] = React.useState<unknown>([])
      const [booleans, setBooleans] = React.useState<unknown>([])
      return (
        <>
          <ValueEditor
            descriptor={{ type: 'array', item: { type: 'number' } }}
            value={numbers}
            onChange={setNumbers}
            options={[]}
            ariaLabel="Scores value"
          />
          <ValueEditor
            descriptor={{ type: 'array', item: { type: 'boolean' } }}
            value={booleans}
            onChange={setBooleans}
            options={[]}
            ariaLabel="Flags value"
          />
          <output>{JSON.stringify({ booleans, numbers })}</output>
        </>
      )
    }

    const view = render(<Harness />)
    const scores = view.getByLabelText('Scores value')
    fireEvent.change(scores, { target: { value: '1, 2.5' } })
    fireEvent.blur(scores)
    const flags = view.getByLabelText('Flags value')
    fireEvent.change(flags, { target: { value: 'true, false' } })
    fireEvent.blur(flags)

    expect(
      view.getByText('{"booleans":[true,false],"numbers":[1,2.5]}')
    ).toBeTruthy()
  })

  test('preserves an invalid structured draft until it becomes valid JSON', async () => {
    const { ValueEditor } = await import('./value-editor')

    const Harness = () => {
      const [value, setValue] = React.useState<unknown>({ name: 'Grace' })
      return (
        <>
          <ValueEditor
            descriptor={{
              type: 'struct',
              fields: { name: { type: 'string' } },
            }}
            value={value}
            onChange={setValue}
            options={[]}
            ariaLabel="Metadata value"
          />
          <output>{JSON.stringify(value)}</output>
        </>
      )
    }

    const view = render(<Harness />)
    const input = view.getByLabelText('Metadata value')
    fireEvent.change(input, { target: { value: '{' } })

    expect(input.getAttribute('value')).toBe('{')
    expect(view.getByText('{"name":"Grace"}')).toBeTruthy()

    fireEvent.change(input, { target: { value: '{"name":"Ada"}' } })
    expect(view.getByText('{"name":"Ada"}')).toBeTruthy()
  })

  test('renders a date descriptor with the segmented date-time input', async () => {
    const { ValueEditor } = await import('./value-editor')

    const view = render(
      <ValueEditor
        descriptor={{ type: 'date' }}
        value="2026-07-20T09:30:00.000Z"
        onChange={() => undefined}
        options={[]}
        ariaLabel="Follow-up time value"
      />
    )

    const field = view.getByRole('group', { name: 'Follow-up time value' })
    expect(field.querySelector('[data-type="minute"]')).toBeTruthy()
  })

  test('renders a tuple of dates as one date-time range input', async () => {
    const { ValueEditor } = await import('./value-editor')

    const view = render(
      <ValueEditor
        descriptor={{
          type: 'tuple',
          items: [{ type: 'date' }, { type: 'date' }],
        }}
        value={['2026-07-20T09:30:00.000Z', '2026-07-22T17:00:00.000Z']}
        onChange={() => undefined}
        options={[]}
        ariaLabel="Follow-up time value"
      />
    )

    expect(
      view.getByRole('group', { name: 'Follow-up time value from' })
    ).toBeTruthy()
    expect(
      view.getByRole('group', { name: 'Follow-up time value to' })
    ).toBeTruthy()
    expect(view.getAllByLabelText('Open calendar')).toHaveLength(1)
  })
})

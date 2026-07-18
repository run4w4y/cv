import { afterEach, describe, expect, it, mock } from 'bun:test'
import { cleanup, fireEvent, render } from '@testing-library/react'
import { Schema } from 'effect'
import * as React from 'react'

import { SchemaEditor } from './schema-editor'

afterEach(cleanup)

const SyntheticEditorSchema = Schema.Struct({
  name: Schema.NonEmptyString.annotate({ title: 'Name' }),
  enabled: Schema.Boolean.annotate({ title: 'Enabled' }),
  note: Schema.optional(Schema.String.annotate({ title: 'Note' })),
  tags: Schema.Array(Schema.String).annotate({ title: 'Tags' }),
  nickname: Schema.NullOr(Schema.String).annotate({ title: 'Nickname' }),
  visibility: Schema.Union([
    Schema.Literal('public'),
    Schema.Literal('private'),
  ]).annotate({ title: 'Visibility' }),
}).annotate({ title: 'Synthetic document' })

const Harness = () => {
  const [value, setValue] = React.useState<unknown>({
    name: '',
    enabled: false,
    tags: [],
    nickname: null,
    visibility: 'public',
  })
  return (
    <>
      <SchemaEditor
        schema={SyntheticEditorSchema}
        value={value}
        onChange={setValue}
      />
      <output data-testid="value">{JSON.stringify(value)}</output>
    </>
  )
}

describe('SchemaEditor', () => {
  it('edits primitives, optional fields, and arrays from a synthetic schema', () => {
    const view = render(<Harness />)

    expect(view.getByText(/length of at least 1/i)).toBeTruthy()

    fireEvent.change(view.getByLabelText('Name'), {
      target: { value: 'Ada' },
    })
    fireEvent.click(view.getByRole('checkbox', { name: 'Enabled' }))
    fireEvent.click(view.getByRole('button', { name: 'Add Note' }))
    fireEvent.change(view.getByLabelText('Note'), {
      target: { value: 'Reviewed' },
    })
    fireEvent.click(view.getByRole('button', { name: 'Add item' }))
    fireEvent.change(view.getByLabelText('Item 1'), {
      target: { value: 'effect' },
    })
    fireEvent.click(view.getByRole('checkbox', { name: 'Set to null' }))
    fireEvent.change(view.getByLabelText('Nickname value'), {
      target: { value: 'A' },
    })
    expect(view.getByRole('combobox', { name: 'Visibility' })).toBeTruthy()

    expect(view.getByTestId('value').textContent).toBe(
      '{"name":"Ada","enabled":true,"tags":["effect"],"nickname":"A","visibility":"public","note":"Reviewed"}'
    )

    fireEvent.click(view.getByRole('button', { name: 'Remove item 1' }))
    fireEvent.click(view.getByRole('button', { name: 'Remove Note' }))
    expect(view.getByTestId('value').textContent).toBe(
      '{"name":"Ada","enabled":true,"tags":[],"nickname":"A","visibility":"public"}'
    )
  })

  it('renders unsupported schemas through a controlled raw JSON editor', () => {
    const onChange = mock(() => undefined)
    const view = render(
      <SchemaEditor schema={Schema.Unknown} value={null} onChange={onChange} />
    )

    expect(
      view.getByText(/unconstrained values require raw json editing/i)
    ).toBeTruthy()
    fireEvent.change(view.getByLabelText('Raw JSON'), {
      target: { value: '{"dynamic":[1,2]}' },
    })
    expect(onChange).toHaveBeenCalledWith({ dynamic: [1, 2] })
  })
})

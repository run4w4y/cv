import type { FilterValueDescriptor } from '@cv/drizzle-query'
import type { Meta, StoryObj } from '@storybook/react-vite'
import * as React from 'react'

import type { QueryFilterOption } from './model'
import { ValueEditor } from './value-editor'

const EditorExample = ({
  label,
  descriptor,
  initialValue,
  options = [],
}: {
  readonly label: string
  readonly descriptor: FilterValueDescriptor
  readonly initialValue: unknown
  readonly options?: readonly QueryFilterOption[]
}) => {
  const [value, setValue] = React.useState(initialValue)

  return (
    <div className="grid gap-2 rounded-md border border-border bg-card p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium">{label}</p>
        <code className="text-xs text-muted-foreground">{descriptor.type}</code>
      </div>
      <ValueEditor
        descriptor={descriptor}
        value={value}
        onChange={setValue}
        options={options}
        ariaLabel={`${label} value`}
      />
      <output className="truncate text-xs text-muted-foreground">
        {JSON.stringify(value)}
      </output>
    </div>
  )
}

const meta = {
  title: 'Drizzle Query/Value Editor',
  component: ValueEditor,
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
  },
  args: {
    descriptor: { type: 'string' },
    value: '',
    onChange: () => undefined,
    options: [],
    ariaLabel: 'Filter value',
  },
} satisfies Meta<typeof ValueEditor>

export default meta
type Story = StoryObj<typeof meta>

export const ScalarDescriptors: Story = {
  render: () => (
    <div className="grid gap-4 md:grid-cols-2">
      <EditorExample
        label="Company"
        descriptor={{ type: 'string' }}
        initialValue="Acme"
      />
      <EditorExample
        label="Fit score"
        descriptor={{ type: 'number' }}
        initialValue={75}
      />
      <EditorExample
        label="Needs follow-up"
        descriptor={{ type: 'boolean' }}
        initialValue
      />
      <EditorExample
        label="Follow-up time"
        descriptor={{ type: 'date' }}
        initialValue="2026-07-20T09:30:00.000Z"
      />
      <EditorExample
        label="Application status"
        descriptor={{
          type: 'enum',
          values: ['applied', 'interview', 'offer'],
        }}
        initialValue="interview"
      />
    </div>
  ),
}

export const CompositeDescriptors: Story = {
  render: () => (
    <div className="grid gap-4">
      <EditorExample
        label="Labels"
        descriptor={{ type: 'array', item: { type: 'string' } }}
        initialValue={['remote']}
        options={[
          { label: 'Remote', value: 'remote' },
          { label: 'Platform', value: 'platform' },
          { label: 'High signal', value: 'high-signal' },
        ]}
      />
      <EditorExample
        label="Fit score range"
        descriptor={{
          type: 'tuple',
          items: [{ type: 'number' }, { type: 'number' }],
        }}
        initialValue={[60, 95]}
      />
      <EditorExample
        label="Follow-up window"
        descriptor={{
          type: 'tuple',
          items: [{ type: 'date' }, { type: 'date' }],
        }}
        initialValue={['2026-07-20T09:30:00.000Z', '2026-07-22T17:00:00.000Z']}
      />
      <EditorExample
        label="Structured metadata"
        descriptor={{
          type: 'struct',
          fields: {
            source: { type: 'string' },
            score: { type: 'number' },
          },
        }}
        initialValue={{ source: 'referral', score: 90 }}
      />
    </div>
  ),
}

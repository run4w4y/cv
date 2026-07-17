import type { Meta, StoryObj } from '@storybook/react-vite'
import {
  functionalUpdate,
  getCoreRowModel,
  useReactTable,
  type VisibilityState,
} from '@tanstack/react-table'
import * as React from 'react'

import type { RegistryEventListItem } from '@cv/application-registry-api-contract'
import { eventColumns } from '../events-table/columns'
import {
  type EventsSavedViewState,
  type EventsTableDensity,
  EventsViewMenu,
} from './render'

const initialState: EventsSavedViewState = {
  filters: [
    {
      type: 'condition',
      field: 'kind',
      operator: 'eq',
      value: 'stage_changed',
    },
  ],
  sorting: [{ id: 'occurredAt', desc: true }],
  columnVisibility: {},
  density: 'comfortable',
}

const EventsViewMenuStory = () => {
  const [state, setState] = React.useState(initialState)
  const [density, setDensity] = React.useState<EventsTableDensity>(
    state.density
  )
  const [columnVisibility, setColumnVisibility] =
    React.useState<VisibilityState>(state.columnVisibility)
  const table = useReactTable({
    data: [] as RegistryEventListItem[],
    columns: [...eventColumns],
    getCoreRowModel: getCoreRowModel(),
    state: { columnVisibility },
    onColumnVisibilityChange: (updater) =>
      setColumnVisibility((current) => functionalUpdate(updater, current)),
  })
  const currentState = { ...state, density, columnVisibility }

  return (
    <div className="flex min-h-96 items-start justify-end bg-background p-8">
      <EventsViewMenu
        table={table}
        density={density}
        onDensityChange={setDensity}
        currentState={currentState}
        onApply={(nextState) => {
          setState(nextState)
          setDensity(nextState.density)
          setColumnVisibility(nextState.columnVisibility)
        }}
        storageKey="@cv/application-registry/events/saved-views:storybook"
      />
    </div>
  )
}

const meta = {
  title: 'Application Registry/Events/View menu',
  component: EventsViewMenuStory,
  tags: ['autodocs'],
} satisfies Meta<typeof EventsViewMenuStory>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

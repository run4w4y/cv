import {
  Badge,
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from '@cv/internal-ui'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { Search } from 'lucide-react'
import * as React from 'react'

import { emptyQueryFiltersState, type QueryFiltersState } from './model'
import {
  QueryFilters,
  QueryFiltersPanel,
  QueryFiltersRoot,
  QueryFiltersToggle,
} from './query-filters'
import {
  applicationFieldPresentation,
  applicationQueryDefinition,
  seededApplicationFilters,
} from './stories/application-query-fixture'

const FiltersHarness = ({
  initialValue,
  defaultExpanded = false,
}: {
  readonly initialValue: QueryFiltersState
  readonly defaultExpanded?: boolean
}) => {
  const [value, setValue] = React.useState(initialValue)

  return (
    <div className="grid w-full gap-6 rounded-lg border border-border bg-card p-5 text-card-foreground">
      <QueryFilters
        definition={applicationQueryDefinition}
        fields={applicationFieldPresentation}
        value={value}
        onValueChange={setValue}
        defaultExpanded={defaultExpanded}
      />
      <div className="grid gap-2">
        <p className="text-xs font-medium text-muted-foreground">
          Drizzle query filter state
        </p>
        <pre className="max-h-72 overflow-auto rounded-md bg-slate-950 p-4 text-xs text-slate-100">
          {JSON.stringify(value, null, 2)}
        </pre>
      </div>
    </div>
  )
}

const QueueManagementRecipeHarness = () => {
  const [value, setValue] = React.useState(seededApplicationFilters())

  return (
    <QueryFiltersRoot
      definition={applicationQueryDefinition}
      fields={applicationFieldPresentation}
      value={value}
      onValueChange={setValue}
    >
      <section className="min-w-0 rounded-lg border border-border bg-card p-5 text-card-foreground">
        <div className="flex flex-wrap items-center gap-3">
          <div className="mr-auto flex min-w-0 items-center gap-2">
            <h1 className="truncate text-xl font-semibold">Applications</h1>
            <Badge variant="outline">50 on this page</Badge>
          </div>
          <InputGroup className="min-w-56 flex-1 sm:max-w-80">
            <InputGroupAddon>
              <Search />
            </InputGroupAddon>
            <InputGroupInput
              aria-label="Search applications"
              placeholder="Search applications…"
            />
          </InputGroup>
          <QueryFiltersToggle />
        </div>
        <QueryFiltersPanel className="mt-3" />
      </section>
    </QueryFiltersRoot>
  )
}

const meta = {
  title: 'Drizzle Query/Query Filters',
  component: QueryFilters,
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
  },
  args: {
    definition: applicationQueryDefinition,
    fields: applicationFieldPresentation,
    value: emptyQueryFiltersState(),
    onValueChange: () => undefined,
  },
} satisfies Meta<typeof QueryFilters>

export default meta
type Story = StoryObj<typeof meta>

export const EmptyExpanded: Story = {
  render: () => (
    <FiltersHarness initialValue={emptyQueryFiltersState()} defaultExpanded />
  ),
}

export const ActiveSummary: Story = {
  render: () => <FiltersHarness initialValue={seededApplicationFilters()} />,
}

export const EditableConditions: Story = {
  render: () => (
    <FiltersHarness initialValue={seededApplicationFilters()} defaultExpanded />
  ),
}

export const AnyFilterCombinator: Story = {
  render: () => (
    <FiltersHarness
      initialValue={{ ...seededApplicationFilters(), combinator: 'or' }}
      defaultExpanded
    />
  ),
}

export const DateTimeRange: Story = {
  render: () => (
    <FiltersHarness
      initialValue={{
        combinator: 'and',
        conditions: [
          {
            type: 'condition',
            field: 'followUpAt',
            operator: 'between',
            value: ['2026-07-20T09:30:00.000Z', '2026-07-22T17:00:00.000Z'],
          },
        ],
      }}
      defaultExpanded
    />
  ),
}

export const QueueManagementRecipe: Story = {
  render: () => <QueueManagementRecipeHarness />,
}

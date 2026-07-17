import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'

import { type ApplicationSavedViewState, ApplicationSavedViews } from './render'

const initialState: ApplicationSavedViewState = {
  keyword: '',
  filters: [],
  sorting: [{ id: 'updatedRevision', desc: true }],
  columnVisibility: {},
  density: 'comfortable',
  displayCurrency: 'original',
}

const SavedViewsExample = () => {
  const [state, setState] = useState(initialState)

  return (
    <div className="flex min-h-72 items-start justify-end bg-background p-8">
      <ApplicationSavedViews
        currentState={state}
        onApply={setState}
        storageKey="@cv/application-registry/saved-views:storybook"
      />
    </div>
  )
}

const meta = {
  title: 'Application Registry/Saved views',
  component: ApplicationSavedViews,
  tags: ['autodocs'],
  args: {
    currentState: initialState,
    onApply: () => undefined,
  },
} satisfies Meta<typeof ApplicationSavedViews>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = { render: () => <SavedViewsExample /> }

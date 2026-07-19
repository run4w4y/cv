import type { RegistryActivityListItem } from '@cv/application-registry-api-contract'
import type { Table as TanStackTable } from '@tanstack/react-table'

import {
  defaultSavedViewsStorage,
  SavedViewMenu,
  usePersistentSavedViews,
} from '../../../table-workspace/saved-view-menu'
import {
  EVENTS_SAVED_VIEWS_STORAGE_KEY,
  type EventsSavedViewState,
  type EventsSavedViewsStorage,
  type EventsTableDensity,
} from './model'
import {
  cloneEventsViewState,
  comparableEventsViewState,
  createEventsViewId,
  describeEventsViewState,
  loadEventsSavedViews,
  persistEventsSavedViews,
} from './storage'

export interface EventsViewMenuProps {
  readonly table: TanStackTable<RegistryActivityListItem>
  readonly density: EventsTableDensity
  readonly onDensityChange: (density: EventsTableDensity) => void
  readonly currentState: EventsSavedViewState
  readonly onApply: (state: EventsSavedViewState) => void
  readonly storage?: EventsSavedViewsStorage | null
  readonly storageKey?: string
}

export const EventsViewMenu = ({
  table,
  density,
  onDensityChange,
  currentState,
  onApply,
  storage = defaultSavedViewsStorage(),
  storageKey = EVENTS_SAVED_VIEWS_STORAGE_KEY,
}: EventsViewMenuProps) => {
  const [views, setViews] = usePersistentSavedViews({
    storage,
    storageKey,
    load: loadEventsSavedViews,
    persist: persistEventsSavedViews,
  })
  return (
    <SavedViewMenu
      views={views}
      setViews={setViews}
      currentState={currentState}
      onApply={onApply}
      cloneState={cloneEventsViewState}
      comparableState={comparableEventsViewState}
      createId={createEventsViewId}
      describeState={describeEventsViewState}
      table={table}
      density={density}
      onDensityChange={onDensityChange}
      copy={{
        restoreDescription:
          'Restore filters, sorting, columns, and row density.',
        emptyDescription: 'Save this activity workspace to return to it later.',
        createDescription:
          'This captures the current filters, sorting, visible columns, and density.',
        renameDescription:
          'Choose a concise name that distinguishes this activity workspace.',
        placeholder: 'For example, Recent status changes',
      }}
    />
  )
}

export * from './model'
export * from './storage'

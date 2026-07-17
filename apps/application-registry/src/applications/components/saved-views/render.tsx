import type { ApplicationListItem } from '@cv/application-registry-api-contract'
import type { Table as TanStackTable } from '@tanstack/react-table'

import {
  defaultSavedViewsStorage,
  SavedViewMenu,
  usePersistentSavedViews,
} from '../../../table-workspace/saved-view-menu'
import type { TableDensity } from '../application-table'
import {
  APPLICATION_SAVED_VIEWS_STORAGE_KEY,
  type ApplicationSavedViewState,
  type SavedViewsStorage,
} from './model'
import {
  cloneApplicationViewState,
  comparableApplicationViewState,
  createApplicationViewId,
  describeApplicationViewState,
  loadApplicationSavedViews,
  persistApplicationSavedViews,
} from './storage'

export interface ApplicationSavedViewsProps {
  readonly currentState: ApplicationSavedViewState
  readonly onApply: (state: ApplicationSavedViewState) => void
  readonly table?: TanStackTable<ApplicationListItem>
  readonly density?: TableDensity
  readonly onDensityChange?: (density: TableDensity) => void
  readonly storage?: SavedViewsStorage | null
  readonly storageKey?: string
  readonly className?: string
}

export const ApplicationSavedViews = ({
  currentState,
  onApply,
  table,
  density,
  onDensityChange,
  storage = defaultSavedViewsStorage(),
  storageKey = APPLICATION_SAVED_VIEWS_STORAGE_KEY,
  className,
}: ApplicationSavedViewsProps) => {
  const [views, setViews] = usePersistentSavedViews({
    storage,
    storageKey,
    load: loadApplicationSavedViews,
    persist: persistApplicationSavedViews,
  })
  return (
    <SavedViewMenu
      views={views}
      setViews={setViews}
      currentState={currentState}
      onApply={onApply}
      cloneState={cloneApplicationViewState}
      comparableState={comparableApplicationViewState}
      createId={createApplicationViewId}
      describeState={describeApplicationViewState}
      table={table}
      density={density}
      onDensityChange={onDensityChange}
      className={className}
      copy={{
        restoreDescription:
          'Restore filters, sorting, columns, currency, and row density.',
        emptyDescription: 'Save the current table setup to return to it later.',
        createDescription:
          'This captures the current search, filters, sorting, visible columns, currency, and density.',
        renameDescription:
          'Choose a concise name that distinguishes this table setup.',
        placeholder: 'For example, Active interviews',
      }}
    />
  )
}

export * from './model'
export * from './storage'

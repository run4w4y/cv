import { activityListQuery } from '@cv/application-registry-entity/query'
import { Alert, AlertDescription, AlertTitle, Button } from '@cv/internal-ui'
import { AlertCircle } from 'lucide-react'
import { QueryWorkspaceToolbar } from '../../../table-workspace/query-toolbar'
import { EventsTable } from '../../components/events-table'
import { eventFilterFieldPresentation } from '../../model/filter-fields'
import { useEventsList } from './use-list'
import { useEventsWorkspace } from './use-workspace'

export const EventsPage = () => {
  const workspace = useEventsWorkspace()
  const list = useEventsList(workspace)
  return (
    <section
      data-slot="activities-workspace"
      className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-card"
    >
      <QueryWorkspaceToolbar
        title="Activities"
        description="Inspect backend-issued annotations across every application."
        entityName="activities"
        loadedCount={list.events.length}
        loading={list.loading}
        refreshing={list.loading}
        refreshDisabled={list.refreshDisabled}
        onRefresh={list.refresh}
        definition={activityListQuery}
        presentation={eventFilterFieldPresentation}
        filters={workspace.filters}
      />

      {list.error !== undefined ? (
        <Alert
          variant="destructive"
          className="shrink-0 rounded-none border-x-0 border-t-0 px-5 py-3"
        >
          <AlertCircle />
          <AlertTitle>Could not load activity history</AlertTitle>
          <AlertDescription className="whitespace-normal break-words">
            {list.error}
          </AlertDescription>
          {workspace.filters.decoded.blocksRequest ? null : (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={list.refreshDisabled}
              onClick={list.refresh}
              className="col-start-2 mt-2 w-fit"
            >
              Try again
            </Button>
          )}
        </Alert>
      ) : null}

      <EventsTable
        data={list.events}
        loading={list.loading && list.events.length === 0}
        refreshing={list.refreshing}
        loadingMore={list.loadingMore}
        hasNextPage={list.hasNextPage}
        sorting={workspace.sorting}
        onSortingChange={workspace.setSorting}
        density={workspace.density}
        onDensityChange={workspace.setDensity}
        columnVisibility={workspace.columnVisibility}
        onColumnVisibilityChange={workspace.setColumnVisibility}
        currentViewState={workspace.currentState}
        onApplyView={workspace.applyView}
        onLoadMore={() => void list.loadMore()}
      />
    </section>
  )
}

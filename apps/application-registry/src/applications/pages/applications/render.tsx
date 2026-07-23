import { applicationListQuery } from '@cv/application-registry-entity/query'
import {
  Alert,
  AlertDescription,
  AlertTitle,
  Button,
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from '@cv/internal-ui'
import { useAtomValue } from '@effect/atom-react'
import * as AsyncResult from 'effect/unstable/reactivity/AsyncResult'
import { AlertCircle, Search, X } from 'lucide-react'
import { QueryWorkspaceToolbar } from '../../../table-workspace/query-toolbar'
import { ApplicationsTable } from '../../components/application-table'
import { CurrencyCombobox } from '../../components/currency-combobox'
import { NewApplicationDialog } from '../../components/new-application'
import { ApplicationSavedViews } from '../../components/saved-views'
import { applicationFacetsAtom } from '../../data'
import { useApplicationsList } from './use-list'
import { useApplicationsWorkspace } from './use-workspace'

const emptyLabels: readonly string[] = []

export const ApplicationsPage = () => {
  const facetsResult = useAtomValue(applicationFacetsAtom)
  const facets = AsyncResult.getOrElse(facetsResult, () => undefined)
  const workspace = useApplicationsWorkspace(facets)
  const list = useApplicationsList(workspace)

  return (
    <section
      data-slot="applications-workspace"
      className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-card"
    >
      <QueryWorkspaceToolbar
        title="Applications"
        totalCount={list.totalCount}
        loading={list.loading}
        definition={applicationListQuery}
        presentation={workspace.fieldPresentation}
        filters={workspace.filters}
      >
        <InputGroup className="min-w-56 flex-1 rounded-full border-border sm:max-w-sm">
          <InputGroupInput
            className="pl-4"
            value={workspace.keywordDraft}
            onChange={(event) => workspace.setKeywordDraft(event.target.value)}
            onBlur={() => {
              if (workspace.keywordDraft !== workspace.queryState.keyword)
                workspace.setKeyword(workspace.keywordDraft)
            }}
            placeholder="Search company, role, source…"
            aria-label="Search applications"
          />
          <InputGroupAddon className="gap-1 pr-2 pl-0">
            {workspace.keywordDraft.length > 0 ? (
              <InputGroupButton
                type="button"
                aria-label="Clear application search"
                className="rounded-full"
                onClick={() => {
                  workspace.setKeywordDraft('')
                  workspace.setKeyword('')
                }}
              >
                <X />
              </InputGroupButton>
            ) : (
              <Search />
            )}
          </InputGroupAddon>
        </InputGroup>
        <CurrencyCombobox
          includeOriginal
          value={workspace.queryState.currency}
          ariaLabel="Compensation display currency"
          className="w-52"
          onValueChange={workspace.setCurrency}
        />
      </QueryWorkspaceToolbar>

      {list.error !== undefined ? (
        <Alert
          variant="destructive"
          className="shrink-0 rounded-none border-x-0 border-t-0 px-5 py-3"
        >
          <AlertCircle />
          <AlertTitle>Could not load the registry</AlertTitle>
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

      {list.error === undefined && list.conversionError !== undefined ? (
        <Alert className="shrink-0 rounded-none border-x-0 border-t-0 px-5 py-3">
          <AlertCircle />
          <AlertTitle>Currency conversion unavailable</AlertTitle>
          <AlertDescription className="whitespace-normal break-words">
            {list.conversionError} Original compensation values remain visible.
          </AlertDescription>
        </Alert>
      ) : null}

      <ApplicationsTable
        data={list.applications}
        loading={list.tableLoading}
        loadingMore={list.loadingMore}
        hasNextPage={list.hasNextPage}
        onLoadMore={() => void list.loadMore()}
        sorting={workspace.sorting}
        onSortingChange={workspace.setSorting}
        density={workspace.density}
        onDensityChange={workspace.setDensity}
        columnVisibility={workspace.columnVisibility}
        onColumnVisibilityChange={workspace.setColumnVisibility}
        availableLabels={facets?.labels ?? emptyLabels}
        compensationDisplayCurrency={workspace.queryState.currency}
        compensationFxRateTable={list.compensationFxRateTable}
        headerActions={<NewApplicationDialog />}
        renderViewControl={(table) => (
          <ApplicationSavedViews
            table={table}
            density={workspace.density}
            onDensityChange={workspace.setDensity}
            currentState={workspace.currentState}
            onApply={workspace.applyView}
          />
        )}
      />
    </section>
  )
}

import {
  Alert,
  AlertDescription,
  AlertTitle,
  buttonVariants,
  cn,
} from '@cv/internal-ui'
import { useAtomValue } from '@effect/atom-react'
import * as AsyncResult from 'effect/unstable/reactivity/AsyncResult'
import { ArrowLeft, FileText } from 'lucide-react'
import * as React from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { HeaderActions } from '../../../shell/header-actions'
import {
  ApplicationEditDialog,
  DeleteApplicationDialog,
} from '../../components/application-editor'
import { ApplicationEventsTable } from '../../components/application-events-table'
import { RecordEventDialog } from '../../components/record-event'
import {
  applicationAtom,
  applicationCompensationsAtom,
  applicationEventsAtom,
} from '../../data'
import type { CompensationDisplayCurrency } from '../../model/currency'
import {
  ApplicationCompensation,
  ApplicationDetailsSkeleton,
  ApplicationMetadata,
  ApplicationSummary,
} from './sections'

const resultError = (
  result: AsyncResult.AsyncResult<unknown, unknown>,
  fallback: string
) =>
  AsyncResult.matchWithError(result, {
    onInitial: () => undefined,
    onError: (reason) => (reason instanceof Error ? reason.message : fallback),
    onDefect: (reason) => (reason instanceof Error ? reason.message : fallback),
    onSuccess: () => undefined,
  })

export const ApplicationDetailsPage = () => {
  const { applicationId = '' } = useParams()
  const navigate = useNavigate()
  const [compensationCurrency, setCompensationCurrency] =
    React.useState<CompensationDisplayCurrency>('original')
  const applicationResult = useAtomValue(applicationAtom(applicationId))
  const compensationResult = useAtomValue(
    applicationCompensationsAtom({
      applicationId,
      currency: compensationCurrency,
    })
  )
  const eventsResult = useAtomValue(applicationEventsAtom(applicationId))
  const application = AsyncResult.getOrElse(applicationResult, () => undefined)
  const compensations = AsyncResult.getOrElse(
    compensationResult,
    () => undefined
  )?.items
  const events = AsyncResult.getOrElse(
    eventsResult,
    () => undefined
  )?.items.slice(0, 8)
  const error = resultError(
    applicationResult,
    'The application could not be loaded.'
  )
  const compensationError = resultError(
    compensationResult,
    'The application compensation could not be loaded.'
  )
  const eventsError = resultError(
    eventsResult,
    'The related events could not be loaded.'
  )

  return (
    <section className="min-h-0 flex-1 overflow-y-auto bg-background p-4 lg:p-6">
      {application === undefined ? null : (
        <HeaderActions>
          <RecordEventDialog application={application} />
          <ApplicationEditDialog application={application} />
          <DeleteApplicationDialog
            application={application}
            onDeleted={() => navigate('/applications', { replace: true })}
          />
        </HeaderActions>
      )}
      <div className="mx-auto max-w-6xl">
        <Link
          to="/applications"
          className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }))}
        >
          <ArrowLeft />
          Back to applications
        </Link>
        {error !== undefined ? (
          <Alert variant="destructive" className="mt-4">
            <FileText />
            <AlertTitle>Could not load this application</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : application === undefined ? (
          <ApplicationDetailsSkeleton />
        ) : (
          <>
            <ApplicationSummary application={application} />
            <ApplicationMetadata application={application} />
            <ApplicationCompensation
              currency={compensationCurrency}
              onCurrencyChange={setCompensationCurrency}
              compensations={compensations}
              error={compensationError}
            />
            <ApplicationEventsTable events={events} error={eventsError} />
          </>
        )}
      </div>
    </section>
  )
}

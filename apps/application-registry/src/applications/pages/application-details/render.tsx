import {
  Alert,
  AlertDescription,
  AlertTitle,
  buttonVariants,
  cn,
} from '@cv/internal-ui'
import { useAtomValue } from '@effect/atom-react'
import * as AsyncResult from 'effect/unstable/reactivity/AsyncResult'
import { ArrowLeft, FilePenLine, FileText, WandSparkles } from 'lucide-react'
import * as React from 'react'
import { Link, useParams } from 'react-router'
import { asyncResultErrorMessage } from '@/lib/async-result'
import { HeaderActions } from '../../../shell/header-actions'
import { ApplicationArtifactsCard } from '../../components/application-artifacts'
import { ApplicationEditDialog } from '../../components/application-editor'
import { ApplicationActivitiesTable } from '../../components/application-events-table'
import {
  applicationActivitiesAtom,
  applicationArtifactsAtom,
  applicationAtom,
  applicationCompensationsAtom,
} from '../../data'
import type { CompensationDisplayCurrency } from '../../model/currency'
import {
  ApplicationCompensation,
  ApplicationDetailsSkeleton,
  ApplicationMetadata,
  ApplicationSummary,
} from './sections'

export const ApplicationDetailsPage = () => {
  const { applicationId = '' } = useParams()
  const [compensationCurrency, setCompensationCurrency] =
    React.useState<CompensationDisplayCurrency>('original')
  const applicationResult = useAtomValue(applicationAtom(applicationId))
  const compensationResult = useAtomValue(
    applicationCompensationsAtom(applicationId)
  )
  const activitiesResult = useAtomValue(
    applicationActivitiesAtom(applicationId)
  )
  const artifactsResult = useAtomValue(applicationArtifactsAtom(applicationId))
  const application = AsyncResult.getOrElse(applicationResult, () => undefined)
  const compensations = AsyncResult.getOrElse(
    compensationResult,
    () => undefined
  )?.items
  const activities = AsyncResult.getOrElse(
    activitiesResult,
    () => undefined
  )?.items.slice(0, 8)
  const artifacts = AsyncResult.getOrElse(
    artifactsResult,
    () => undefined
  )?.items
  const error = asyncResultErrorMessage(
    applicationResult,
    'The application could not be loaded.'
  )
  const compensationError = asyncResultErrorMessage(
    compensationResult,
    'The application compensation could not be loaded.'
  )
  const activitiesError = asyncResultErrorMessage(
    activitiesResult,
    'The related activities could not be loaded.'
  )
  const artifactsError = asyncResultErrorMessage(
    artifactsResult,
    'The application artifacts could not be loaded.'
  )

  return (
    <section className="min-h-0 flex-1 overflow-y-auto bg-background p-4 lg:p-6">
      {application === undefined ? null : (
        <HeaderActions>
          <Link
            to={`/applications/${application.id}/prepare`}
            className={cn(buttonVariants())}
          >
            <WandSparkles />
            Prepare CV
          </Link>
          <Link
            to={`/applications/${application.id}/cover-letter`}
            className={cn(buttonVariants({ variant: 'outline' }))}
          >
            <FilePenLine />
            Cover letter
          </Link>
          <ApplicationEditDialog application={application} />
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
            <ApplicationArtifactsCard
              applicationId={application.id}
              artifacts={artifacts}
              error={artifactsError}
            />
            <ApplicationCompensation
              currency={compensationCurrency}
              onCurrencyChange={setCompensationCurrency}
              compensations={compensations}
              error={compensationError}
            />
            <ApplicationActivitiesTable
              activities={activities}
              error={activitiesError}
            />
          </>
        )}
      </div>
    </section>
  )
}

import type {
  Application,
  ApplicationCompensation as ApplicationCompensationValue,
} from '@cv/application-registry-entity'
import {
  Alert,
  AlertDescription,
  AlertTitle,
  Badge,
  buttonVariants,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  cn,
  Skeleton,
} from '@cv/internal-ui'
import {
  CircleDollarSign,
  ExternalLink,
  FileText,
  MapPin,
  Tags,
} from 'lucide-react'
import type React from 'react'

import { formatDateTime, formatLabel } from '../../../lib/format'
import { AnnualCompensation } from '../../components/annual-compensation'
import { CurrencyCombobox } from '../../components/currency-combobox'
import { ListingAvailabilityReviewDialog } from '../../components/listing-availability-review'
import { StatusBadge } from '../../components/status-badge'
import type {
  CompensationDisplayCurrency,
  CompensationFxRateTable,
} from '../../model/currency'

const Detail = ({
  label,
  children,
}: {
  readonly label: string
  readonly children: React.ReactNode
}) => (
  <div>
    <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
    <dd className="mt-1 text-sm text-foreground">{children}</dd>
  </div>
)

export const ApplicationDetailsSkeleton = () => (
  <Card className="mt-4">
    <CardContent className="p-6">
      <Skeleton className="h-7 w-52" />
      <Skeleton className="mt-3 h-5 w-80" />
      <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 9 }, (_, index) => `detail-${index}`).map(
          (key) => (
            <div key={key}>
              <Skeleton className="h-3 w-20" />
              <Skeleton className="mt-2 h-5 w-36" />
            </div>
          )
        )}
      </div>
    </CardContent>
  </Card>
)

export const ApplicationSummary = ({
  application,
}: {
  readonly application: Application
}) => (
  <Card className="mt-4">
    <CardContent className="p-5 lg:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">
              {application.company}
            </h1>
            <StatusBadge value={application.applicationStatus} />
          </div>
          <p className="mt-2 text-lg text-muted-foreground">
            {application.role}
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <MapPin className="size-3.5" />
              {application.location ?? 'Location not specified'}
            </span>
            <span className="font-mono">{application.id}</span>
          </div>
        </div>
        <a
          href={application.postingUrl}
          target="_blank"
          rel="noreferrer"
          className={cn(buttonVariants({ variant: 'outline' }))}
        >
          Open listing <ExternalLink />
        </a>
      </div>
    </CardContent>
  </Card>
)

export const ApplicationMetadata = ({
  application,
}: {
  readonly application: Application
}) => (
  <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(18rem,1fr)]">
    <Card>
      <CardHeader className="flex-row items-center gap-2 pb-0">
        <FileText className="size-4 text-primary" />
        <CardTitle>Application details</CardTitle>
      </CardHeader>
      <CardContent>
        <dl className="mt-5 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          <Detail label="Target stage">
            <Badge variant="outline">
              {formatLabel(application.targetStage)}
            </Badge>
          </Detail>
          <Detail label="Personal priority">
            {application.personalPriority === null
              ? '—'
              : formatLabel(application.personalPriority)}
          </Detail>
          <Detail label="Follow up">
            {formatDateTime(application.followUpAt)}
          </Detail>
          <Detail label="Applied">
            {formatDateTime(application.appliedAt)}
          </Detail>
        </dl>
      </CardContent>
    </Card>
    <Card>
      <CardHeader className="flex-row items-center gap-2 pb-0">
        <Tags className="size-4 text-primary" />
        <CardTitle>Registry metadata</CardTitle>
      </CardHeader>
      <CardContent>
        <dl className="mt-5 grid gap-5">
          <Detail label="Listing availability">
            <ListingAvailabilityReviewDialog application={application} />
          </Detail>
          <Detail label="Version">{application.version}</Detail>
          <Detail label="Revision">{application.updatedRevision}</Detail>
          <Detail label="Created">
            {formatDateTime(application.createdAt)}
          </Detail>
          <Detail label="Updated">
            {formatDateTime(application.updatedAt)}
          </Detail>
        </dl>
      </CardContent>
    </Card>
  </div>
)

export const ApplicationCompensation = ({
  currency,
  onCurrencyChange,
  compensations,
  error,
  conversionError,
  rateTable,
}: {
  readonly currency: CompensationDisplayCurrency
  readonly onCurrencyChange: (currency: CompensationDisplayCurrency) => void
  readonly compensations?: readonly ApplicationCompensationValue[]
  readonly error?: string
  readonly conversionError?: string
  readonly rateTable?: CompensationFxRateTable
}) => {
  const annual = compensations?.filter(
    (compensation) => compensation.period === 'year'
  )
  return (
    <Card className="mt-4">
      <CardHeader className="flex-row flex-wrap items-center gap-2 pb-0">
        <CircleDollarSign className="size-4 text-primary" />
        <CardTitle>Annual compensation</CardTitle>
        <CurrencyCombobox
          includeOriginal
          value={currency}
          ariaLabel="Compensation currency"
          className="ml-auto w-56"
          onValueChange={onCurrencyChange}
        />
      </CardHeader>
      <CardContent>
        <p className="mt-2 text-xs text-muted-foreground">
          {currency === 'original'
            ? 'Showing the original stored values.'
            : `Showing converted ${currency} values using client-side Frankfurter rates.`}
        </p>
        {conversionError !== undefined ? (
          <Alert className="mt-4">
            <AlertTitle>Currency conversion unavailable</AlertTitle>
            <AlertDescription>
              {conversionError} Original compensation values remain visible.
            </AlertDescription>
          </Alert>
        ) : null}
        {error !== undefined ? (
          <Alert variant="destructive" className="mt-4">
            <AlertTitle>Could not load compensation</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : annual === undefined ? (
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
          </div>
        ) : annual.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">
            No annual compensation has been provided.
          </p>
        ) : (
          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {annual.map((original) => {
              return (
                <div
                  key={original.id}
                  className="rounded-md border border-border p-3"
                >
                  <Badge variant="secondary" className="mb-3">
                    {formatLabel(original.kind)}
                  </Badge>
                  <AnnualCompensation
                    value={{
                      currencyCode: original.currencyCode,
                      minimumMinor: original.minimumMinor,
                      maximumMinor: original.maximumMinor,
                    }}
                    displayCurrency={currency}
                    rateTable={rateTable}
                  />
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

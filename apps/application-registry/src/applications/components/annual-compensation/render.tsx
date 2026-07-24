import type { ApplicationListItem } from '@cv/application-registry-api-contract'
import { Skeleton } from '@cv/internal-ui'
import { useAtomSuspense } from '@effect/atom-react'
import * as React from 'react'
import { compensationFxRateAtom } from '../../data'
import {
  type CompensationDisplayCurrency,
  currencyFractionDigits,
  type DisplayedAnnualCompensation,
  displayAnnualCompensation,
  minorAmountToMajor,
} from '../../model/currency'

const formattersByCurrency = new Map<string, Intl.NumberFormat>()

const compensationFormatter = (currencyCode: string) => {
  const cached = formattersByCurrency.get(currencyCode)
  if (cached !== undefined) return cached

  const fractionDigits = currencyFractionDigits(currencyCode)
  const formatter = new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: currencyCode,
    currencyDisplay: 'narrowSymbol',
    maximumFractionDigits: fractionDigits,
  })
  formattersByCurrency.set(currencyCode, formatter)
  return formatter
}

export const formatCompensationAmount = (
  amountMinor: number | null,
  currencyCode: string
) => {
  if (amountMinor === null) return '—'

  return compensationFormatter(currencyCode).format(
    minorAmountToMajor(amountMinor, currencyCode)
  )
}

const AnnualCompensationValue = ({
  displayed,
  displayCurrency,
}: {
  readonly displayed: DisplayedAnnualCompensation
  readonly displayCurrency: CompensationDisplayCurrency
}) => {
  if (displayed.value === null) {
    return <span className="text-sm text-muted-foreground">Not provided</span>
  }

  return (
    <div className="min-w-48">
      <div className="grid grid-cols-2 gap-1">
        <div>
          <p className="text-[0.625rem] font-semibold tracking-wide text-muted-foreground uppercase">
            From
          </p>
          <p className="mt-0.5 whitespace-nowrap text-sm font-medium tabular-nums">
            {formatCompensationAmount(
              displayed.value.minimumMinor,
              displayed.value.currencyCode
            )}
          </p>
        </div>
        <div>
          <p className="text-[0.625rem] font-semibold tracking-wide text-muted-foreground uppercase">
            To
          </p>
          <p className="mt-0.5 whitespace-nowrap text-sm font-medium tabular-nums">
            {formatCompensationAmount(
              displayed.value.maximumMinor,
              displayed.value.currencyCode
            )}
          </p>
        </div>
      </div>
      <p className="mt-1 text-[0.6875rem] text-muted-foreground">
        {displayed.value.currencyCode} · annual
        {displayed.status === 'converted' && displayed.observedAt !== undefined
          ? ` · FX ${displayed.observedAt.slice(0, 10)}`
          : displayed.status === 'unavailable'
            ? ` · ${displayCurrency} conversion unavailable`
            : ''}
      </p>
    </div>
  )
}

export const AnnualCompensationSkeleton = () => (
  <div className="min-w-48" aria-busy="true">
    <div className="grid grid-cols-2 gap-1" aria-hidden="true">
      <div>
        <Skeleton className="h-2.5 w-8" />
        <Skeleton className="mt-1 h-5 w-20" />
      </div>
      <div>
        <Skeleton className="h-2.5 w-5" />
        <Skeleton className="mt-1 h-5 w-20" />
      </div>
    </div>
    <Skeleton className="mt-1.5 h-3 w-24" aria-hidden="true" />
  </div>
)

const ConvertedAnnualCompensation = ({
  value,
  displayCurrency,
}: {
  readonly value: NonNullable<ApplicationListItem['annualCompensation']>
  readonly displayCurrency: string
}) => {
  const result = useAtomSuspense(
    compensationFxRateAtom({
      sourceCurrency: value.currencyCode,
      targetCurrency: displayCurrency,
    }),
    { includeFailure: true }
  )
  const displayed = displayAnnualCompensation(
    value,
    displayCurrency,
    result._tag === 'Success' ? result.value : undefined
  )

  return (
    <AnnualCompensationValue
      displayed={displayed}
      displayCurrency={displayCurrency}
    />
  )
}

export const AnnualCompensation = ({
  value,
  displayCurrency = 'original',
}: {
  readonly value: ApplicationListItem['annualCompensation']
  readonly displayCurrency?: CompensationDisplayCurrency
}) => {
  if (
    value === null ||
    displayCurrency === 'original' ||
    value.currencyCode === displayCurrency
  ) {
    return (
      <AnnualCompensationValue
        displayed={displayAnnualCompensation(value, displayCurrency)}
        displayCurrency={displayCurrency}
      />
    )
  }

  return (
    <React.Suspense fallback={<AnnualCompensationSkeleton />}>
      <ConvertedAnnualCompensation
        value={value}
        displayCurrency={displayCurrency}
      />
    </React.Suspense>
  )
}

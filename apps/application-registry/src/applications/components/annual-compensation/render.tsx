import type { ApplicationListItem } from '@cv/application-registry-api-contract'
import {
  type CompensationDisplayCurrency,
  type CompensationFxRateTable,
  currencyFractionDigits,
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

export const AnnualCompensation = ({
  value,
  displayCurrency = 'original',
  rateTable,
}: {
  readonly value: ApplicationListItem['annualCompensation']
  readonly displayCurrency?: CompensationDisplayCurrency
  readonly rateTable?: CompensationFxRateTable
}) => {
  const displayed = displayAnnualCompensation(value, displayCurrency, rateTable)
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

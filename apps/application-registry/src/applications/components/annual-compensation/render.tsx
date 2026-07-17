import type { ApplicationListItem } from '@cv/application-registry-api-contract'
import {
  currencyFractionDigits,
  minorAmountToMajor,
} from '../../model/currency'

export const formatCompensationAmount = (
  amountMinor: number | null,
  currencyCode: string
) => {
  if (amountMinor === null) return '—'

  const fractionDigits = currencyFractionDigits(currencyCode)

  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: currencyCode,
    currencyDisplay: 'narrowSymbol',
    maximumFractionDigits: fractionDigits,
  }).format(minorAmountToMajor(amountMinor, currencyCode))
}

export const AnnualCompensation = ({
  value,
}: {
  readonly value: ApplicationListItem['annualCompensation']
}) => {
  if (value === null) {
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
            {formatCompensationAmount(value.minimumMinor, value.currencyCode)}
          </p>
        </div>
        <div>
          <p className="text-[0.625rem] font-semibold tracking-wide text-muted-foreground uppercase">
            To
          </p>
          <p className="mt-0.5 whitespace-nowrap text-sm font-medium tabular-nums">
            {formatCompensationAmount(value.maximumMinor, value.currencyCode)}
          </p>
        </div>
      </div>
      <p className="mt-1 text-[0.6875rem] text-muted-foreground">
        {value.currencyCode} · annual
      </p>
    </div>
  )
}

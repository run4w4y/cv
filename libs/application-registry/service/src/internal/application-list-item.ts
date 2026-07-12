import type { ApplicationListRecord } from '@cv/application-registry-crud'
import type {
  ApplicationCompensation,
  CurrencyCode,
} from '@cv/application-registry-entity'

import type { ApplicationListItem, FollowUpState } from '../types'

const currencyFractionDigits = (currencyCode: CurrencyCode) =>
  new Intl.NumberFormat('en-US', {
    currency: currencyCode,
    style: 'currency',
  }).resolvedOptions().maximumFractionDigits ?? 0

const formatMinorAmount = (amount: number, currencyCode: CurrencyCode) => {
  const fractionDigits = currencyFractionDigits(currencyCode)
  const majorAmount = amount / 10 ** fractionDigits
  const formatted = new Intl.NumberFormat('en-US', {
    maximumFractionDigits: fractionDigits,
  }).format(majorAmount)
  return `${currencyCode} ${formatted}`
}

const formatRange = ({
  currencyCode,
  maximumMinor,
  minimumMinor,
}: ApplicationCompensation) => {
  if (minimumMinor === null) {
    return maximumMinor === null
      ? `${currencyCode} amount unspecified`
      : `up to ${formatMinorAmount(maximumMinor, currencyCode)}`
  }
  if (maximumMinor === null) {
    return `${formatMinorAmount(minimumMinor, currencyCode)}+`
  }
  if (minimumMinor === maximumMinor) {
    return formatMinorAmount(minimumMinor, currencyCode)
  }

  const maximum = formatMinorAmount(maximumMinor, currencyCode).slice(
    currencyCode.length + 1
  )
  return `${formatMinorAmount(minimumMinor, currencyCode)}–${maximum}`
}

const formatPeriod = (period: ApplicationCompensation['period']) =>
  period === 'unknown'
    ? ''
    : period === 'one_time'
      ? ' (one time)'
      : ` / ${period}`

const formatKind = (kind: ApplicationCompensation['kind']) => {
  const words = kind.replaceAll('_', ' ')
  return `${words.charAt(0).toUpperCase()}${words.slice(1)}`
}

export const formatCompensationSummary = (
  compensations: readonly ApplicationCompensation[]
) =>
  compensations.length === 0
    ? null
    : compensations
        .map(
          (compensation) =>
            `${formatKind(compensation.kind)}: ${formatRange(compensation)}${formatPeriod(compensation.period)}`
        )
        .join('; ')

export const resolveFollowUpState = (
  followUpAt: string | null,
  now: string
): FollowUpState =>
  followUpAt === null ? 'none' : followUpAt < now ? 'overdue' : 'upcoming'

export const toApplicationListItem = (
  record: ApplicationListRecord,
  now: string,
  displayedCompensations?: readonly ApplicationCompensation[]
): ApplicationListItem => {
  const { compensations, ...application } = record
  return {
    ...application,
    compensationSummary: formatCompensationSummary(
      displayedCompensations ?? compensations
    ),
    followUpState: resolveFollowUpState(application.followUpAt, now),
  }
}

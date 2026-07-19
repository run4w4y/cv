import type { ApplicationCompensationResponseItem } from '@cv/application-registry-api-contract'
import type {
  Application,
  ApplicationActivity,
  CurrencyCode,
} from '@cv/application-registry-entity'
import { Console, Effect } from 'effect'
import type { RegistryWriteResult } from '../client'

export const printJson = (value: unknown) =>
  Effect.try({
    try: () => JSON.stringify(value, null, 2),
    catch: (cause) =>
      new Error(
        `Could not render application registry JSON: ${cause instanceof Error ? cause.message : String(cause)}`
      ),
  }).pipe(Effect.flatMap(Console.log))

const formatApplication = (application: Application) =>
  [
    `${application.company} — ${application.role}`,
    `ID: ${application.id}`,
    `Status: ${application.applicationStatus}`,
    `Target stage: ${application.targetStage}`,
    `URL: ${application.postingUrl}`,
    `Location: ${application.location ?? '—'}`,
    `Updated: ${application.updatedAt}`,
  ].join('\n')

export const printApplications = (
  applications: readonly Application[],
  json: boolean
) => {
  if (json) {
    return printJson(applications)
  }
  if (applications.length === 0) {
    return Console.log('No applications found.')
  }
  return Console.log(applications.map(formatApplication).join('\n\n'))
}

export const printApplication = (application: Application, json: boolean) =>
  json ? printJson(application) : Console.log(formatApplication(application))

const formatActivity = (activity: ApplicationActivity) =>
  `${activity.occurredAt}  ${activity.kind}  ${activity.actor}/${activity.source}  ${JSON.stringify(activity.payload)}`

export const printActivities = (
  activities: readonly ApplicationActivity[],
  json: boolean
) =>
  json
    ? printJson(activities)
    : activities.length === 0
      ? Console.log('No activities found.')
      : Console.log(activities.map(formatActivity).join('\n'))

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

const formatRange = (
  currencyCode: CurrencyCode,
  minimumMinor: number | null,
  maximumMinor: number | null
) => {
  if (minimumMinor === null) {
    if (maximumMinor === null) {
      return `${currencyCode} amount unspecified`
    }
    return `up to ${formatMinorAmount(maximumMinor, currencyCode)}`
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

const formatPeriod = (
  period: ApplicationCompensationResponseItem['original']['period']
) =>
  period === 'unknown'
    ? ''
    : period === 'one_time'
      ? ' (one time)'
      : ` / ${period}`

const formatCompensation = ({
  conversion,
  original,
}: ApplicationCompensationResponseItem) => {
  const title = original.kind
    .split('_')
    .map((part, index) =>
      index === 0 ? `${part.charAt(0).toUpperCase()}${part.slice(1)}` : part
    )
    .join(' ')
  const period = formatPeriod(original.period)
  const lines = [
    title,
    `Original: ${formatRange(original.currencyCode, original.minimumMinor, original.maximumMinor)}${period}`,
  ]

  if (conversion !== null) {
    lines.push(
      `Converted: ${formatRange(conversion.currencyCode, conversion.minimumMinor, conversion.maximumMinor)}${period}`,
      `Rate: ${conversion.rate} (${conversion.provider}, observed ${conversion.observedAt})`
    )
  }

  lines.push(`Source: ${original.source}`)
  if (original.rawText !== null) {
    lines.push(`Raw: ${original.rawText}`)
  }
  return lines.join('\n')
}

export const printCompensations = (
  compensations: readonly ApplicationCompensationResponseItem[],
  json: boolean
) =>
  json
    ? printJson(compensations)
    : compensations.length === 0
      ? Console.log('No compensation records found.')
      : Console.log(compensations.map(formatCompensation).join('\n\n'))

export const printWriteResult = <A>(
  result: RegistryWriteResult<A>,
  json: boolean
) => {
  if (json) {
    return printJson(result)
  }
  return result.status === 'synced'
    ? Console.log('Registry updated and synchronized.')
    : Console.log(
        `Registry update queued as ${result.operationId}. ${result.failure}`
      )
}

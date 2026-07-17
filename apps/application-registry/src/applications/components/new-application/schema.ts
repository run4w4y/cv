import type { CreateApplicationRequest } from '@cv/application-registry-api-contract'
import {
  ApplicationStatusSchema,
  TargetStageSchema,
} from '@cv/application-registry-entity'
import { Schema } from 'effect'

import { majorAmountToMinor } from '../../model/currency'

const requiredText = (label: string) =>
  Schema.Trim.pipe(
    Schema.check(Schema.isNonEmpty({ message: `${label} is required.` }))
  )

const optionalText = (value: string) => {
  const trimmed = value.trim()
  return trimmed.length === 0 ? null : trimmed
}

const validUrl = Schema.makeFilter((value: string) => {
  try {
    new URL(value)
    return true
  } catch {
    return 'Enter a valid canonical URL.'
  }
})

const compensationIssues = (value: {
  readonly currencyCode: string
  readonly annualFrom: string
  readonly annualTo: string
}): readonly Schema.FilterIssue[] => {
  const hasCompensation =
    value.annualFrom.trim().length > 0 || value.annualTo.trim().length > 0
  if (!hasCompensation) return []
  const issues: Schema.FilterIssue[] = []
  let minimumMinor: number | null = null
  let maximumMinor: number | null = null
  try {
    minimumMinor = majorAmountToMinor(value.annualFrom, value.currencyCode)
  } catch (reason) {
    issues.push({
      path: ['annualFrom'],
      issue:
        reason instanceof Error
          ? reason.message
          : 'Enter a valid annual compensation minimum.',
    })
  }
  try {
    maximumMinor = majorAmountToMinor(value.annualTo, value.currencyCode)
  } catch (reason) {
    issues.push({
      path: ['annualTo'],
      issue:
        reason instanceof Error
          ? reason.message
          : 'Enter a valid annual compensation maximum.',
    })
  }
  if (
    minimumMinor !== null &&
    maximumMinor !== null &&
    minimumMinor > maximumMinor
  ) {
    issues.push({
      path: ['annualTo'],
      issue: 'Annual compensation From must not exceed To.',
    })
  }
  return issues
}

export const NewApplicationFormSchema = Schema.Struct({
  jobKey: requiredText('Job key'),
  source: requiredText('Source'),
  sourceJobId: Schema.String,
  canonicalUrl: requiredText('Canonical URL').pipe(Schema.check(validUrl)),
  company: requiredText('Company'),
  role: requiredText('Role'),
  location: Schema.String,
  applicationStatus: ApplicationStatusSchema,
  targetStage: TargetStageSchema,
  currencyCode: Schema.String,
  annualFrom: Schema.String,
  annualTo: Schema.String,
}).pipe(Schema.check(Schema.makeFilter(compensationIssues)))

export type NewApplicationFormInput = Schema.Codec.Encoded<
  typeof NewApplicationFormSchema
>
export type NewApplicationFormOutput = Schema.Schema.Type<
  typeof NewApplicationFormSchema
>

export const newApplicationDefaults: NewApplicationFormInput = {
  jobKey: '',
  source: 'manual',
  sourceJobId: '',
  canonicalUrl: '',
  company: '',
  role: '',
  location: '',
  applicationStatus: 'not_started',
  targetStage: 'backlog',
  currencyCode: 'USD',
  annualFrom: '',
  annualTo: '',
}

export const newApplicationRequestFromOutput = (
  values: NewApplicationFormOutput
): CreateApplicationRequest => {
  const hasCompensation =
    values.annualFrom.trim().length > 0 || values.annualTo.trim().length > 0
  const currencyCode = values.currencyCode.trim().toUpperCase()
  return {
    jobKey: values.jobKey,
    source: values.source,
    sourceJobId: optionalText(values.sourceJobId),
    canonicalUrl: values.canonicalUrl,
    company: values.company,
    role: values.role,
    location: optionalText(values.location),
    applicationStatus: values.applicationStatus,
    targetStage: values.targetStage,
    ...(hasCompensation
      ? {
          compensations: [
            {
              kind: 'base_salary',
              currencyCode,
              minimumMinor: majorAmountToMinor(values.annualFrom, currencyCode),
              maximumMinor: majorAmountToMinor(values.annualTo, currencyCode),
              period: 'year',
              rawText: null,
              source: 'manual',
            },
          ],
        }
      : {}),
  }
}

export const newApplicationRequest = (
  values: NewApplicationFormInput
): CreateApplicationRequest =>
  newApplicationRequestFromOutput(
    Schema.decodeUnknownSync(NewApplicationFormSchema)(values)
  )

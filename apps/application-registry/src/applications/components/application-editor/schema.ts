import type { ApplicationListItem } from '@cv/application-registry-api-contract'
import {
  type Application,
  ApplicationSchema,
  CurrencyCodeSchema,
  FitScoreSchema,
  NonEmptyTrimmedStringSchema,
  UtcIsoTimestampSchema,
} from '@cv/application-registry-entity'
import { AnnualCompensationSchema } from '@cv/application-registry-entity/query'
import { Schema, SchemaGetter } from 'effect'

import { majorAmountToMinor, minorAmountToMajor } from '../../model/currency'

const requiredText = (label: string) =>
  Schema.Trim.pipe(
    Schema.check(Schema.isNonEmpty({ message: `${label} is required.` }))
  )

const NullableTextFromString = Schema.String.pipe(
  Schema.decodeTo(Schema.NullOr(NonEmptyTrimmedStringSchema), {
    decode: SchemaGetter.transform((value) => {
      const trimmed = value.trim()
      return trimmed.length === 0 ? null : trimmed
    }),
    encode: SchemaGetter.transform((value) => value ?? ''),
  })
)

const NullableFitScoreFromString = Schema.Union([
  Schema.Literal(''),
  Schema.NumberFromString,
]).pipe(
  Schema.decodeTo(Schema.NullOr(FitScoreSchema), {
    decode: SchemaGetter.transform((value) => (value === '' ? null : value)),
    encode: SchemaGetter.transform((value) => value ?? ''),
  })
)

const NullableTimestampFromDate = Schema.NullOr(Schema.Date).pipe(
  Schema.decodeTo(Schema.NullOr(UtcIsoTimestampSchema), {
    decode: SchemaGetter.transform((value) => value?.toISOString() ?? null),
    encode: SchemaGetter.transform((value) =>
      value === null ? null : new Date(value)
    ),
  })
)

const CurrencyCodeFromString = Schema.String.pipe(
  Schema.decodeTo(CurrencyCodeSchema, {
    decode: SchemaGetter.transform((value) => value.trim().toUpperCase()),
    encode: SchemaGetter.transform((value) => value),
  })
)

const compensationIssues = (value: {
  readonly currencyCode: string
  readonly from: string
  readonly to: string
}): readonly Schema.FilterIssue[] => {
  const issues: Schema.FilterIssue[] = []
  let minimumMinor: number | null = null
  let maximumMinor: number | null = null

  try {
    minimumMinor = majorAmountToMinor(value.from, value.currencyCode)
  } catch (reason) {
    issues.push({
      path: ['from'],
      issue:
        reason instanceof Error
          ? reason.message
          : 'Enter a valid annual compensation minimum.',
    })
  }
  try {
    maximumMinor = majorAmountToMinor(value.to, value.currencyCode)
  } catch (reason) {
    issues.push({
      path: ['to'],
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
      path: ['to'],
      issue: 'Annual compensation To must be greater than or equal to From.',
    })
  }
  return issues
}

const AnnualCompensationFormSourceSchema = Schema.Struct({
  currencyCode: CurrencyCodeFromString,
  from: Schema.String,
  to: Schema.String,
}).pipe(Schema.check(Schema.makeFilter(compensationIssues)))

export const AnnualCompensationFormSchema =
  AnnualCompensationFormSourceSchema.pipe(
    Schema.decodeTo(Schema.NullOr(AnnualCompensationSchema), {
      decode: SchemaGetter.transform((value) => {
        const minimumMinor = majorAmountToMinor(value.from, value.currencyCode)
        const maximumMinor = majorAmountToMinor(value.to, value.currencyCode)
        return minimumMinor === null && maximumMinor === null
          ? null
          : {
              currencyCode: value.currencyCode,
              minimumMinor,
              maximumMinor,
            }
      }),
      encode: SchemaGetter.transform((value) => {
        const currencyCode = value?.currencyCode ?? 'USD'
        return {
          currencyCode,
          from:
            value?.minimumMinor === null || value?.minimumMinor === undefined
              ? ''
              : String(minorAmountToMajor(value.minimumMinor, currencyCode)),
          to:
            value?.maximumMinor === null || value?.maximumMinor === undefined
              ? ''
              : String(minorAmountToMajor(value.maximumMinor, currencyCode)),
        }
      }),
    })
  )

const LabelsSchema = Schema.Array(
  Schema.Trim.pipe(
    Schema.check(Schema.isNonEmpty({ message: 'Labels cannot be empty.' }))
  )
)

export const ApplicationRowEditFormSchema = Schema.Struct({
  company: requiredText('Company'),
  location: NullableTextFromString,
  role: requiredText('Role'),
  applicationStatus: ApplicationSchema.fields.applicationStatus,
  targetStage: ApplicationSchema.fields.targetStage,
  fitScore: NullableFitScoreFromString,
  personalPriority: ApplicationSchema.fields.personalPriority,
  labels: LabelsSchema,
  annualCompensation: AnnualCompensationFormSchema,
  followUpAt: NullableTimestampFromDate,
})

export type ApplicationRowEditFormInput = Schema.Codec.Encoded<
  typeof ApplicationRowEditFormSchema
>
export type ApplicationRowEditFormOutput = Schema.Schema.Type<
  typeof ApplicationRowEditFormSchema
>

export const applicationRowEditDefaults = (
  application: ApplicationListItem
): ApplicationRowEditFormInput => {
  const annualCompensation = application.annualCompensation
  const currencyCode = annualCompensation?.currencyCode ?? 'USD'
  return {
    company: application.company,
    location: application.location ?? '',
    role: application.role,
    applicationStatus: application.applicationStatus,
    targetStage: application.targetStage,
    fitScore: application.fitScore === null ? '' : String(application.fitScore),
    personalPriority: application.personalPriority,
    labels: [...application.labels],
    annualCompensation: {
      currencyCode,
      from:
        annualCompensation?.minimumMinor === null ||
        annualCompensation?.minimumMinor === undefined
          ? ''
          : String(
              minorAmountToMajor(annualCompensation.minimumMinor, currencyCode)
            ),
      to:
        annualCompensation?.maximumMinor === null ||
        annualCompensation?.maximumMinor === undefined
          ? ''
          : String(
              minorAmountToMajor(annualCompensation.maximumMinor, currencyCode)
            ),
    },
    followUpAt:
      application.followUpAt === null ? null : new Date(application.followUpAt),
  }
}

const CanonicalUrlSchema = Schema.Trim.pipe(
  Schema.decodeTo(Schema.URLFromString)
)

export const ApplicationDetailEditFormSchema = Schema.Struct({
  company: requiredText('Company'),
  role: requiredText('Role'),
  canonicalUrl: CanonicalUrlSchema,
  location: NullableTextFromString,
  applicationStatus: ApplicationSchema.fields.applicationStatus,
  targetStage: ApplicationSchema.fields.targetStage,
  personalPriority: ApplicationSchema.fields.personalPriority,
  fitScore: NullableFitScoreFromString,
  category: NullableTextFromString,
  remotePolicy: NullableTextFromString,
  technologyStack: NullableTextFromString,
  recommendedAction: NullableTextFromString,
  followUpAt: NullableTimestampFromDate,
})

export type ApplicationDetailEditFormInput = Schema.Codec.Encoded<
  typeof ApplicationDetailEditFormSchema
>
export type ApplicationDetailEditFormOutput = Schema.Schema.Type<
  typeof ApplicationDetailEditFormSchema
>

export const applicationDetailEditDefaults = (
  application: Application
): ApplicationDetailEditFormInput => ({
  company: application.company,
  role: application.role,
  canonicalUrl: application.canonicalUrl,
  location: application.location ?? '',
  applicationStatus: application.applicationStatus,
  targetStage: application.targetStage,
  personalPriority: application.personalPriority,
  fitScore: application.fitScore === null ? '' : String(application.fitScore),
  category: application.category ?? '',
  remotePolicy: application.remotePolicy ?? '',
  technologyStack: application.technologyStack ?? '',
  recommendedAction: application.recommendedAction ?? '',
  followUpAt:
    application.followUpAt === null ? null : new Date(application.followUpAt),
})

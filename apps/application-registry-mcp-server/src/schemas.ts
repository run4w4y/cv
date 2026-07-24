import {
  ApplicationAnnotationsResponseSchema,
  ListApplicationActivitiesResponseSchema,
  ListApplicationsResponseSchema,
} from '@cv/application-registry-api-contract'
import {
  ApplicationCompanySchema,
  ApplicationCompensationInputSchema,
  ApplicationLocationSchema,
  ApplicationNoteSchema,
  ApplicationRoleSchema,
  ApplicationSchema,
  ApplicationStatusSchema,
  ExpectedApplicationVersionSchema,
  HttpUrlSchema,
  NonEmptyTrimmedStringSchema,
  PersonalPrioritySchema,
  TargetStageSchema,
  UtcIsoTimestampSchema,
} from '@cv/application-registry-entity'
import { AnnualCompensationSchema } from '@cv/application-registry-entity/query'
import { Schema } from 'effect'

const optionalTimestamp = Schema.optionalKey(
  Schema.NullOr(UtcIsoTimestampSchema)
)

const pageSizeSchema = Schema.Int.pipe(
  Schema.check(Schema.isBetween({ minimum: 1, maximum: 100 }))
)

export const SearchApplicationsParametersSchema = Schema.Struct({
  query: Schema.optionalKey(
    NonEmptyTrimmedStringSchema.annotate({
      description:
        'Case-insensitive text matched against posting URL, company, role, and location.',
    })
  ),
  applicationStatus: Schema.optionalKey(ApplicationStatusSchema),
  targetStage: Schema.optionalKey(TargetStageSchema),
  limit: Schema.optionalKey(
    pageSizeSchema.annotate({
      description: 'Number of results to return. Defaults to 20; maximum 100.',
    })
  ),
  cursor: Schema.optionalKey(
    NonEmptyTrimmedStringSchema.annotate({
      description: 'Opaque nextCursor returned by an earlier search.',
    })
  ),
})

export const GetApplicationParametersSchema = Schema.Struct({
  identifier: NonEmptyTrimmedStringSchema.annotate({
    description: 'The application ID returned by search_applications.',
  }),
})

export const ListApplicationHistoryParametersSchema =
  GetApplicationParametersSchema

export { ApplicationCompensationInputSchema }

export const CreateApplicationParametersSchema = Schema.Struct({
  postingUrl: HttpUrlSchema,
  company: ApplicationCompanySchema,
  role: ApplicationRoleSchema,
  location: Schema.NullOr(ApplicationLocationSchema).annotate({
    description: 'Use null when the listing does not specify a location.',
  }),
  applicationStatus: Schema.optionalKey(ApplicationStatusSchema),
  targetStage: Schema.optionalKey(TargetStageSchema),
  personalPriority: Schema.optionalKey(Schema.NullOr(PersonalPrioritySchema)),
  followUpAt: optionalTimestamp,
  appliedAt: optionalTimestamp,
  compensations: Schema.optionalKey(
    Schema.Array(ApplicationCompensationInputSchema)
  ),
  labels: Schema.optionalKey(Schema.Array(NonEmptyTrimmedStringSchema)),
})

export const UpdateApplicationParametersSchema = Schema.Struct({
  identifier: NonEmptyTrimmedStringSchema.annotate({
    description: 'The application ID returned by search_applications.',
  }),
  expectedVersion: ExpectedApplicationVersionSchema.annotate({
    description:
      'Current application version returned by get_application or search_applications. Updates fail on stale versions.',
  }),
  postingUrl: Schema.optionalKey(HttpUrlSchema),
  company: Schema.optionalKey(ApplicationCompanySchema),
  role: Schema.optionalKey(ApplicationRoleSchema),
  location: Schema.optionalKey(Schema.NullOr(ApplicationLocationSchema)),
  applicationStatus: Schema.optionalKey(ApplicationStatusSchema),
  targetStage: Schema.optionalKey(TargetStageSchema),
  personalPriority: Schema.optionalKey(Schema.NullOr(PersonalPrioritySchema)),
  followUpAt: optionalTimestamp,
  appliedAt: optionalTimestamp,
  annualCompensation: Schema.optionalKey(
    Schema.NullOr(AnnualCompensationSchema)
  ),
  labels: Schema.optionalKey(Schema.Array(NonEmptyTrimmedStringSchema)),
})

export const CorrespondenceClassificationSchema = Schema.Literals([
  'submission_confirmed',
  'recruiter_interview_scheduled',
  'technical_screen_scheduled',
  'take_home_received',
  'later_interview_scheduled',
  'offer_received',
  'employer_rejection',
  'candidate_withdrawal',
  'contact_logged',
])

export const RecordApplicationCorrespondenceParametersSchema = Schema.Struct({
  identifier: NonEmptyTrimmedStringSchema.annotate({
    description: 'The matched application ID.',
  }),
  expectedVersion: ExpectedApplicationVersionSchema.annotate({
    description:
      'Current application version read immediately before recording the correspondence.',
  }),
  operationId: NonEmptyTrimmedStringSchema.annotate({
    description:
      'Stable caller-generated ID for this message and classification. Reuse it verbatim on retries.',
  }),
  gmailMessageId: NonEmptyTrimmedStringSchema.annotate({
    description: 'Stable Gmail message ID used for duplicate detection.',
  }),
  gmailThreadId: NonEmptyTrimmedStringSchema.annotate({
    description: 'Stable Gmail thread ID containing the message.',
  }),
  occurredAt: UtcIsoTimestampSchema.annotate({
    description: 'Timestamp of the correspondence, not the processing time.',
  }),
  classification: CorrespondenceClassificationSchema,
  evidenceSummary: NonEmptyTrimmedStringSchema.annotate({
    description:
      'Concise factual evidence supporting the classification; do not include speculative conclusions.',
  }),
  appliedAt: Schema.optionalKey(
    UtcIsoTimestampSchema.annotate({
      description:
        'Earliest confirmed submission timestamp. Required for post-submission stages when the registry has no appliedAt.',
    })
  ),
})

export const ApplicationResultSchema = Schema.Struct({
  application: ApplicationSchema,
})

export const UpdateApplicationResultSchema = Schema.Struct({
  operationId: Schema.String,
  annualCompensation: Schema.NullOr(AnnualCompensationSchema),
  application: ApplicationSchema,
  labels: Schema.Array(NonEmptyTrimmedStringSchema),
})

export const RecordApplicationCorrespondenceResultSchema = Schema.Struct({
  operationId: NonEmptyTrimmedStringSchema,
  note: ApplicationNoteSchema,
  noteReplayed: Schema.Boolean,
  application: ApplicationSchema,
  applicationUpdated: Schema.Boolean,
  updateOperationId: Schema.NullOr(NonEmptyTrimmedStringSchema),
  requiresReview: Schema.Boolean,
})

export {
  ApplicationAnnotationsResponseSchema,
  ListApplicationActivitiesResponseSchema,
  ListApplicationsResponseSchema,
}

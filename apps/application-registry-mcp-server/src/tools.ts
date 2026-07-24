import type {
  AddApplicationNoteRequest,
  CreateApplicationRequest,
  ListApplicationsQuery,
  UpdateApplicationRequest,
} from '@cv/application-registry-api-contract'
import type {
  Application,
  ApplicationStatus,
} from '@cv/application-registry-entity'
import { Crypto, Effect } from 'effect'
import { Tool, Toolkit } from 'effect/unstable/ai'

import {
  ApplicationRegistryToolError,
  correspondenceAppliedAtError,
  correspondenceVersionConflictError,
  invalidUpdateError,
  operationIdError,
} from './errors'
import { ApplicationRegistryGateway } from './gateway'
import {
  ApplicationResultSchema,
  ApplicationAnnotationsResponseSchema,
  type CorrespondenceClassificationSchema,
  CreateApplicationParametersSchema,
  GetApplicationParametersSchema,
  ListApplicationActivitiesResponseSchema,
  ListApplicationHistoryParametersSchema,
  ListApplicationsResponseSchema,
  RecordApplicationCorrespondenceParametersSchema,
  RecordApplicationCorrespondenceResultSchema,
  SearchApplicationsParametersSchema,
  UpdateApplicationParametersSchema,
  UpdateApplicationResultSchema,
} from './schemas'

const SearchApplications = Tool.make('search_applications', {
  description:
    'Search application listings. Use this before updates to find an application ID and its current version.',
  parameters: SearchApplicationsParametersSchema,
  success: ListApplicationsResponseSchema,
  failure: ApplicationRegistryToolError,
})
  .annotate(Tool.Title, 'Search applications')
  .annotate(Tool.Readonly, true)
  .annotate(Tool.Destructive, false)
  .annotate(Tool.Idempotent, true)
  .annotate(Tool.OpenWorld, false)

const GetApplication = Tool.make('get_application', {
  description:
    'Get one application listing by ID, including the version required for a safe update.',
  parameters: GetApplicationParametersSchema,
  success: ApplicationResultSchema,
  failure: ApplicationRegistryToolError,
})
  .annotate(Tool.Title, 'Get application')
  .annotate(Tool.Readonly, true)
  .annotate(Tool.Destructive, false)
  .annotate(Tool.Idempotent, true)
  .annotate(Tool.OpenWorld, false)

const ListApplicationActivities = Tool.make('list_application_activities', {
  description:
    'List the immutable activity history for one application. Use this to understand prior status and note changes before recording correspondence.',
  parameters: ListApplicationHistoryParametersSchema,
  success: ListApplicationActivitiesResponseSchema,
  failure: ApplicationRegistryToolError,
})
  .annotate(Tool.Title, 'List application activities')
  .annotate(Tool.Readonly, true)
  .annotate(Tool.Destructive, false)
  .annotate(Tool.Idempotent, true)
  .annotate(Tool.OpenWorld, false)

const ListApplicationAnnotations = Tool.make('list_application_annotations', {
  description:
    'List labels and notes for one application. Check notes for an existing Gmail message ID before recording correspondence.',
  parameters: ListApplicationHistoryParametersSchema,
  success: ApplicationAnnotationsResponseSchema,
  failure: ApplicationRegistryToolError,
})
  .annotate(Tool.Title, 'List application annotations')
  .annotate(Tool.Readonly, true)
  .annotate(Tool.Destructive, false)
  .annotate(Tool.Idempotent, true)
  .annotate(Tool.OpenWorld, false)

const CreateApplication = Tool.make('create_application', {
  description:
    'Create a new application listing. Posting URLs are normalized by the registry and duplicate listings are rejected.',
  parameters: CreateApplicationParametersSchema,
  success: ApplicationResultSchema,
  failure: ApplicationRegistryToolError,
})
  .annotate(Tool.Title, 'Create application')
  .annotate(Tool.Readonly, false)
  .annotate(Tool.Destructive, false)
  .annotate(Tool.Idempotent, false)
  .annotate(Tool.OpenWorld, false)

const UpdateApplication = Tool.make('update_application', {
  description:
    'Update fields on an existing application listing with optimistic concurrency. Read the current version first and do not retry a version conflict blindly.',
  parameters: UpdateApplicationParametersSchema,
  success: UpdateApplicationResultSchema,
  failure: ApplicationRegistryToolError,
})
  .annotate(Tool.Title, 'Update application')
  .annotate(Tool.Readonly, false)
  .annotate(Tool.Destructive, true)
  .annotate(Tool.Idempotent, false)
  .annotate(Tool.OpenWorld, false)

const RecordApplicationCorrespondence = Tool.make(
  'record_application_correspondence',
  {
    description:
      'Idempotently record matched Gmail correspondence as a contact note and, when the classification warrants it, update the application status using optimistic concurrency. Read the application and annotations first. Reuse operationId verbatim on retries.',
    parameters: RecordApplicationCorrespondenceParametersSchema,
    success: RecordApplicationCorrespondenceResultSchema,
    failure: ApplicationRegistryToolError,
  }
)
  .annotate(Tool.Title, 'Record application correspondence')
  .annotate(Tool.Readonly, false)
  .annotate(Tool.Destructive, true)
  .annotate(Tool.Idempotent, true)
  .annotate(Tool.OpenWorld, false)

export const ApplicationRegistryToolkit = Toolkit.make(
  SearchApplications,
  GetApplication,
  ListApplicationActivities,
  ListApplicationAnnotations,
  CreateApplication,
  UpdateApplication,
  RecordApplicationCorrespondence
)

const searchQuery = (
  parameters: typeof SearchApplicationsParametersSchema.Type
): ListApplicationsQuery => ({
  filters: [
    ...(parameters.query === undefined
      ? []
      : [
          {
            type: 'condition' as const,
            field: 'q' as const,
            operator: 'matches' as const,
            value: parameters.query,
          },
        ]),
    ...(parameters.applicationStatus === undefined
      ? []
      : [
          {
            type: 'condition' as const,
            field: 'applicationStatus' as const,
            operator: 'eq' as const,
            value: parameters.applicationStatus,
          },
        ]),
    ...(parameters.targetStage === undefined
      ? []
      : [
          {
            type: 'condition' as const,
            field: 'targetStage' as const,
            operator: 'eq' as const,
            value: parameters.targetStage,
          },
        ]),
  ],
  pagination: {
    ...(parameters.cursor === undefined ? {} : { after: parameters.cursor }),
    size: parameters.limit ?? 20,
  },
})

const updateFieldNames = [
  'postingUrl',
  'company',
  'role',
  'location',
  'applicationStatus',
  'targetStage',
  'personalPriority',
  'followUpAt',
  'appliedAt',
  'annualCompensation',
  'labels',
] as const

const hasUpdate = (
  parameters: typeof UpdateApplicationParametersSchema.Type
): boolean => updateFieldNames.some((field) => field in parameters)

type CorrespondenceClassification =
  typeof CorrespondenceClassificationSchema.Type

const correspondenceStatus: Readonly<
  Partial<Record<CorrespondenceClassification, ApplicationStatus>>
> = {
  submission_confirmed: 'applied',
  recruiter_interview_scheduled: 'recruiter_screen',
  technical_screen_scheduled: 'technical_screen',
  take_home_received: 'take_home',
  later_interview_scheduled: 'interview_loop',
  offer_received: 'offer',
  employer_rejection: 'rejected',
  candidate_withdrawal: 'withdrawn',
}

const postSubmissionStatuses = new Set<ApplicationStatus>([
  'recruiter_screen',
  'technical_screen',
  'take_home',
  'interview_loop',
  'offer',
])

const correspondenceNoteBody = (
  parameters: typeof RecordApplicationCorrespondenceParametersSchema.Type
) =>
  [
    'Gmail correspondence',
    `Gmail message ID: ${parameters.gmailMessageId}`,
    `Gmail thread ID: ${parameters.gmailThreadId}`,
    `Occurred at: ${parameters.occurredAt}`,
    `Classification: ${parameters.classification}`,
    `Evidence: ${parameters.evidenceSummary}`,
  ].join('\n')

const correspondenceUpdate = (
  application: Application,
  parameters: typeof RecordApplicationCorrespondenceParametersSchema.Type
): Omit<UpdateApplicationRequest, 'expectedVersion'> => {
  const applicationStatus = correspondenceStatus[parameters.classification]
  const appliedAt =
    application.appliedAt === null
      ? (parameters.appliedAt ??
        (parameters.classification === 'submission_confirmed'
          ? parameters.occurredAt
          : undefined))
      : undefined

  return {
    ...(applicationStatus === undefined ||
    application.applicationStatus === applicationStatus
      ? {}
      : { applicationStatus }),
    ...(appliedAt === undefined ? {} : { appliedAt }),
  }
}

const hasCorrespondenceUpdate = (
  request: Omit<UpdateApplicationRequest, 'expectedVersion'>
) => Object.keys(request).length > 0

export const makeApplicationRegistryToolkitHandlers = Effect.gen(function* () {
  const gateway = yield* ApplicationRegistryGateway
  const crypto = yield* Crypto.Crypto

  return ApplicationRegistryToolkit.of({
    search_applications: Effect.fn('ApplicationRegistryMcp.searchApplications')(
      (parameters) => gateway.list(searchQuery(parameters))
    ),
    get_application: Effect.fn('ApplicationRegistryMcp.getApplication')(
      ({ identifier }) =>
        gateway
          .show(identifier)
          .pipe(Effect.map((application) => ({ application })))
    ),
    list_application_activities: Effect.fn(
      'ApplicationRegistryMcp.listApplicationActivities'
    )(({ identifier }) => gateway.listActivities(identifier)),
    list_application_annotations: Effect.fn(
      'ApplicationRegistryMcp.listApplicationAnnotations'
    )(({ identifier }) => gateway.listAnnotations(identifier)),
    create_application: Effect.fn('ApplicationRegistryMcp.createApplication')(
      (parameters) =>
        gateway
          .create(parameters satisfies CreateApplicationRequest)
          .pipe(Effect.map((application) => ({ application })))
    ),
    update_application: Effect.fn('ApplicationRegistryMcp.updateApplication')(
      function* (parameters) {
        if (!hasUpdate(parameters)) return yield* invalidUpdateError

        const operationId = yield* crypto.randomUUIDv7.pipe(
          Effect.mapError(() => operationIdError)
        )
        const { identifier, ...request } = parameters
        const response = yield* gateway.update(
          identifier,
          operationId,
          request satisfies UpdateApplicationRequest
        )

        return { operationId, ...response }
      }
    ),
    record_application_correspondence: Effect.fn(
      'ApplicationRegistryMcp.recordApplicationCorrespondence'
    )(function* (parameters) {
      const before = yield* gateway.show(parameters.identifier)
      if (before.version !== parameters.expectedVersion) {
        return yield* correspondenceVersionConflictError(
          parameters.expectedVersion,
          before.version
        )
      }

      const targetStatus = correspondenceStatus[parameters.classification]
      if (
        targetStatus !== undefined &&
        postSubmissionStatuses.has(targetStatus) &&
        before.appliedAt === null &&
        parameters.appliedAt === undefined
      ) {
        return yield* correspondenceAppliedAtError
      }

      const noteResponse = yield* gateway.addNote(
        parameters.identifier,
        `${parameters.operationId}:note`,
        {
          body: correspondenceNoteBody(parameters),
          kind: 'contact',
          source: 'gmail',
        } satisfies AddApplicationNoteRequest
      )
      const afterNote = yield* gateway.show(parameters.identifier)
      const update = correspondenceUpdate(afterNote, parameters)
      const baseResult = {
        application: afterNote,
        applicationUpdated: false,
        note: noteResponse.note,
        noteReplayed: noteResponse.replayed,
        operationId: parameters.operationId,
        requiresReview: false,
        updateOperationId: null,
      } as const

      if (!hasCorrespondenceUpdate(update)) return baseResult

      if (
        !noteResponse.replayed &&
        afterNote.version !== parameters.expectedVersion + 1
      ) {
        return { ...baseResult, requiresReview: true }
      }

      const updateOperationId = `${parameters.operationId}:update`
      return yield* gateway
        .update(parameters.identifier, updateOperationId, {
          ...update,
          expectedVersion: afterNote.version,
        })
        .pipe(
          Effect.map((response) => ({
            application: response.application,
            applicationUpdated: true,
            note: noteResponse.note,
            noteReplayed: noteResponse.replayed,
            operationId: parameters.operationId,
            requiresReview: false,
            updateOperationId,
          })),
          Effect.catch((error) =>
            error.kind === 'conflict'
              ? gateway.show(parameters.identifier).pipe(
                  Effect.map((application) => ({
                    ...baseResult,
                    application,
                    requiresReview: true,
                  }))
                )
              : Effect.fail(error)
          )
        )
    }),
  })
})

export const ApplicationRegistryToolkitHandlers =
  ApplicationRegistryToolkit.toLayer(makeApplicationRegistryToolkitHandlers)

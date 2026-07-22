import type {
  CreateApplicationRequest,
  ListApplicationsQuery,
  UpdateApplicationRequest,
} from '@cv/application-registry-api-contract'
import { Crypto, Effect } from 'effect'
import { Tool, Toolkit } from 'effect/unstable/ai'

import {
  ApplicationRegistryToolError,
  invalidUpdateError,
  operationIdError,
} from './errors'
import { ApplicationRegistryGateway } from './gateway'
import {
  ApplicationResultSchema,
  CreateApplicationParametersSchema,
  GetApplicationParametersSchema,
  ListApplicationsResponseSchema,
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

export const ApplicationRegistryToolkit = Toolkit.make(
  SearchApplications,
  GetApplication,
  CreateApplication,
  UpdateApplication
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
  })
})

export const ApplicationRegistryToolkitHandlers =
  ApplicationRegistryToolkit.toLayer(makeApplicationRegistryToolkitHandlers)

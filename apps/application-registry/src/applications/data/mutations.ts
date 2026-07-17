import type {
  AppendApplicationEventRequest,
  CreateApplicationRequest,
  ResolveListingAvailabilityRequest,
  UpdateManagedApplicationRequest,
} from '@cv/application-registry-api-contract'

import { RegistryClient } from '../../lib/registry-client'
import { applicationMutationKeys, createApplicationMutationKeys } from './keys'

const createApplicationRequest = RegistryClient.mutation(
  'registry',
  'createApplication'
)
const updateManagedApplicationRequest = RegistryClient.mutation(
  'registry',
  'updateManagedApplication'
)
const deleteApplicationRequest = RegistryClient.mutation(
  'registry',
  'deleteApplication'
)
const appendApplicationEventRequest = RegistryClient.mutation(
  'registry',
  'appendApplicationEvent'
)
const resolveApplicationListingAvailabilityRequest = RegistryClient.mutation(
  'registry',
  'resolveApplicationListingAvailability'
)

export const createApplication =
  RegistryClient.runtime.fn<CreateApplicationRequest>()((input, get) =>
    get.setResult(createApplicationRequest, {
      payload: input,
      reactivityKeys: createApplicationMutationKeys,
    })
  )

export type UpdateManagedApplicationInput = {
  readonly applicationId: string
  readonly input: UpdateManagedApplicationRequest
}

export const updateManagedApplication =
  RegistryClient.runtime.fn<UpdateManagedApplicationInput>()(
    ({ applicationId, input }, get) =>
      get.setResult(updateManagedApplicationRequest, {
        params: { id: applicationId },
        payload: input,
        reactivityKeys: applicationMutationKeys(applicationId),
      })
  )

export type DeleteApplicationInput = {
  readonly applicationId: string
  readonly expectedVersion: number
}

export const deleteApplication =
  RegistryClient.runtime.fn<DeleteApplicationInput>()(
    ({ applicationId, expectedVersion }, get) =>
      get.setResult(deleteApplicationRequest, {
        params: { id: applicationId },
        query: { expectedVersion },
        reactivityKeys: applicationMutationKeys(applicationId),
      })
  )

export type AppendApplicationEventInput = {
  readonly applicationId: string
  readonly input: AppendApplicationEventRequest
}

export const appendApplicationEvent =
  RegistryClient.runtime.fn<AppendApplicationEventInput>()(
    ({ applicationId, input }, get) => {
      const reactivityKeys = applicationMutationKeys(applicationId)
      if ('nextApplicationStatus' in input) {
        return get.setResult(appendApplicationEventRequest, {
          params: { id: applicationId },
          payload: input,
          reactivityKeys,
        })
      }
      return get.setResult(appendApplicationEventRequest, {
        params: { id: applicationId },
        payload: input,
        reactivityKeys,
      })
    }
  )

export type ResolveApplicationListingAvailabilityInput = {
  readonly applicationId: string
  readonly input: ResolveListingAvailabilityRequest
}

export const resolveApplicationListingAvailability =
  RegistryClient.runtime.fn<ResolveApplicationListingAvailabilityInput>()(
    ({ applicationId, input }, get) =>
      get.setResult(resolveApplicationListingAvailabilityRequest, {
        params: { id: applicationId },
        payload: input,
        reactivityKeys: applicationMutationKeys(applicationId),
      })
  )

import type {
  CreateApplicationRequest,
  ResolveListingAvailabilityRequest,
  UpdateApplicationRequest,
} from '@cv/application-registry-api-contract'

import { RegistryClient, registryMutation } from '../../lib/registry-client'
import { applicationMutationKeys, createApplicationMutationKeys } from './keys'

const createApplicationRequest = registryMutation('createApplication')
const updateApplicationRequest = registryMutation('updateApplication')
const resolveApplicationListingAvailabilityRequest = registryMutation(
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
  readonly idempotencyKey: string
  readonly input: UpdateApplicationRequest
}

export const updateManagedApplication =
  RegistryClient.runtime.fn<UpdateManagedApplicationInput>()(
    ({ applicationId, idempotencyKey, input }, get) =>
      get.setResult(updateApplicationRequest, {
        headers: { 'idempotency-key': idempotencyKey },
        params: { id: applicationId },
        payload: input,
        reactivityKeys: applicationMutationKeys(applicationId),
      })
  )

export type ResolveApplicationListingAvailabilityInput = {
  readonly applicationId: string
  readonly idempotencyKey: string
  readonly input: ResolveListingAvailabilityRequest
}

export const resolveApplicationListingAvailability =
  RegistryClient.runtime.fn<ResolveApplicationListingAvailabilityInput>()(
    ({ applicationId, idempotencyKey, input }, get) =>
      get.setResult(resolveApplicationListingAvailabilityRequest, {
        headers: { 'idempotency-key': idempotencyKey },
        params: { id: applicationId },
        payload: input,
        reactivityKeys: applicationMutationKeys(applicationId),
      })
  )

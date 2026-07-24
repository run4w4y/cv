import type {
  CreateApplicationArtifactRequest,
  CreateApplicationRequest,
  ResolveListingAvailabilityRequest,
  UpdateApplicationRequest,
} from '@cv/application-registry-api-contract'
import type { ApplicationArtifactCategory } from '@cv/application-registry-entity'
import { Effect } from 'effect'

import { RegistryClient, registryMutation } from '../../lib/registry-client'
import {
  applicationMutationKeys,
  applicationReactivity,
  createApplicationMutationKeys,
} from './keys'

const createApplicationArtifactRequest = registryMutation(
  'createApplicationArtifact'
)
const createApplicationRequest = registryMutation('createApplication')
const putBlobRequest = registryMutation('putBlob')
const updateApplicationRequest = registryMutation('updateApplication')
const resolveApplicationListingAvailabilityRequest = registryMutation(
  'resolveApplicationListingAvailability'
)

export type UploadApplicationArtifactInput = {
  readonly applicationId: string
  readonly category: ApplicationArtifactCategory
  readonly file: File
  readonly filename: string
  readonly locale?: string
  readonly operationId: string
}

const sha256Hex = Effect.fn('ApplicationArtifacts.sha256Hex')(
  (bytes: Uint8Array) =>
    Effect.tryPromise({
      try: async () => {
        const digest = new Uint8Array(
          await crypto.subtle.digest('SHA-256', bytes.slice())
        )
        return Array.from(digest, (byte) =>
          byte.toString(16).padStart(2, '0')
        ).join('')
      },
      catch: (cause) =>
        new Error('The artifact could not be hashed.', { cause }),
    })
)

export const uploadApplicationArtifact =
  RegistryClient.runtime.fn<UploadApplicationArtifactInput>()((input, get) =>
    Effect.gen(function* () {
      const bytes = yield* Effect.tryPromise({
        try: async () => new Uint8Array(await input.file.arrayBuffer()),
        catch: (cause) =>
          new Error('The selected artifact could not be read.', { cause }),
      })
      const sha256 = yield* sha256Hex(bytes)
      const mediaType =
        input.file.type.trim() ||
        (input.filename.toLocaleLowerCase('en-US').endsWith('.pdf')
          ? 'application/pdf'
          : 'application/octet-stream')
      yield* get.setResult(putBlobRequest, {
        params: { sha256 },
        payload: bytes,
      })
      const payload: CreateApplicationArtifactRequest = {
        blob: { mediaType, sha256 },
        category: input.category,
        filename: input.filename,
        ...(input.locale === undefined ? {} : { locale: input.locale }),
      }
      return yield* get.setResult(createApplicationArtifactRequest, {
        headers: { 'idempotency-key': input.operationId },
        params: { id: input.applicationId },
        payload,
        reactivityKeys: [applicationReactivity.artifacts(input.applicationId)],
      })
    })
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

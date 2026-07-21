import {
  FactsCurrentPointerV2Schema,
  factsCurrentPointerV2ContractId,
  factsReleaseBundleMediaType,
  factsReleaseBundleV1ContractId,
  factsReleaseManifestV2ContractId,
} from '@cv/facts-release'
import { Schema } from 'effect'
import {
  HttpApiMiddleware,
  HttpApiSchema,
  HttpApiSecurity,
} from 'effect/unstable/httpapi'

import {
  ServiceUnavailableErrorSchema,
  UnauthorizedErrorSchema,
} from './errors'
import { applicationRegistryMachinePrefix } from './transport'

export const factsPublicationProtocolV1ContractId =
  'cv.facts-publication.v1' as const
export const factsPublicationApiPrefix =
  `${applicationRegistryMachinePrefix}/api/registry/facts` as const

export class FactsPublisherAuthorization extends HttpApiMiddleware.Service<FactsPublisherAuthorization>()(
  '@cv/application-registry-api-contract/FactsPublisherAuthorization',
  {
    error: [UnauthorizedErrorSchema, ServiceUnavailableErrorSchema],
    security: { bearer: HttpApiSecurity.bearer },
  }
) {}

export const FactsReleaseBundleBodySchema = Schema.Uint8Array.pipe(
  HttpApiSchema.asUint8Array({ contentType: factsReleaseBundleMediaType })
)

export const FactsReleaseParamsSchema = Schema.Struct({
  releaseId: Schema.String.pipe(
    Schema.check(Schema.isPattern(/^fr_[a-f0-9]{64}$/u))
  ),
})

export const ActivateFactsReleaseRequestSchema = Schema.Struct({
  expectedCurrentReleaseId: Schema.NullOr(
    FactsReleaseParamsSchema.fields.releaseId
  ),
  releaseId: FactsReleaseParamsSchema.fields.releaseId,
})
export interface ActivateFactsReleaseRequest
  extends Schema.Schema.Type<typeof ActivateFactsReleaseRequestSchema> {}

export const FactsPublicationCapabilitiesSchema = Schema.Struct({
  bundleContract: Schema.Literal(factsReleaseBundleV1ContractId),
  pointerContract: Schema.Literal(factsCurrentPointerV2ContractId),
  protocol: Schema.Literal(factsPublicationProtocolV1ContractId),
  releaseContract: Schema.Literal(factsReleaseManifestV2ContractId),
})
export interface FactsPublicationCapabilities
  extends Schema.Schema.Type<typeof FactsPublicationCapabilitiesSchema> {}

export const FactsRegistrationResponseSchema = Schema.Struct({
  objectCount: Schema.Int.pipe(Schema.check(Schema.isGreaterThan(0))),
  releaseId: FactsReleaseParamsSchema.fields.releaseId,
  status: Schema.Literals(['already-registered', 'registered']),
})
export interface FactsRegistrationResponse
  extends Schema.Schema.Type<typeof FactsRegistrationResponseSchema> {}

export const FactsActivationResponseSchema = Schema.Struct({
  releaseId: FactsReleaseParamsSchema.fields.releaseId,
  status: Schema.Literals(['activated', 'already-active']),
})
export interface FactsActivationResponse
  extends Schema.Schema.Type<typeof FactsActivationResponseSchema> {}

export const ActiveFactsReleaseResponseSchema = FactsCurrentPointerV2Schema
export type ActiveFactsReleaseResponse = Schema.Schema.Type<
  typeof ActiveFactsReleaseResponseSchema
>

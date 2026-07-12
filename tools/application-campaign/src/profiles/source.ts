import { Context, type Effect } from 'effect'
import type { ApplicationCampaignContentError } from '../errors'
import type { ProfileCatalog, ProfileCatalogIndex } from './catalog'

export type CampaignProfileLoadRequest = {
  readonly locale: string
  readonly profiles: readonly string[]
}

export type CampaignProfileCollection = ProfileCatalogIndex & {
  readonly load: (
    request: CampaignProfileLoadRequest
  ) => Effect.Effect<ProfileCatalog, ApplicationCampaignContentError>
}

export type CampaignProfileSourceService = {
  readonly open: (input: {
    readonly contentRoot: string
  }) => Effect.Effect<
    CampaignProfileCollection,
    ApplicationCampaignContentError
  >
}

export class CampaignProfileSource extends Context.Service<
  CampaignProfileSource,
  CampaignProfileSourceService
>()('@cv/application-campaign/CampaignProfileSource') {}

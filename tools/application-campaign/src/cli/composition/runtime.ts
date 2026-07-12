import {
  ApplicationRegistryClient,
  makeApplicationRegistryClientLayer,
  readOptionalApplicationRegistryClientConfig,
} from '@cv/application-registry'
import { Crypto, Effect, Layer, Option } from 'effect'
import {
  CampaignPlugins,
  makeCampaignPluginsService,
} from '../../plugins/service'
import { makeApplicationCampaignRuntimeLayer } from '../../runtime'
import { makeApplicationRegistryCampaignPlugin } from '../plugins/application-registry'
import { RepositoryCampaignProfileSource } from './profile-source'

const BaseRuntimeLayer = makeApplicationCampaignRuntimeLayer(
  RepositoryCampaignProfileSource
)

const RegistryPluginsLayer = Layer.unwrap(
  readOptionalApplicationRegistryClientConfig.pipe(
    Effect.map(
      Option.match({
        onNone: () =>
          Layer.effect(CampaignPlugins, makeCampaignPluginsService([])),
        onSome: (config) =>
          Layer.effect(
            CampaignPlugins,
            Effect.gen(function* () {
              const client = yield* ApplicationRegistryClient
              const crypto = yield* Crypto.Crypto
              return yield* makeCampaignPluginsService([
                makeApplicationRegistryCampaignPlugin({
                  client,
                  crypto,
                  deviceId: config.deviceId,
                }),
              ])
            })
          ).pipe(Layer.provide(makeApplicationRegistryClientLayer(config))),
      })
    )
  )
)

export const ApplicationCampaignCliLayer = RegistryPluginsLayer.pipe(
  Layer.provideMerge(BaseRuntimeLayer)
)

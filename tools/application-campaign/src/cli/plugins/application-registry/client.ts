import type { ApplicationRegistryClientService } from '@cv/application-registry'
import type { Effect } from 'effect'

type RegistryCapture = ApplicationRegistryClientService['capture']
type RegistryCaptureEffect = ReturnType<RegistryCapture>
type RegistrySyncEffect = ReturnType<ApplicationRegistryClientService['sync']>
type RegistryListEffect = ReturnType<ApplicationRegistryClientService['list']>

type CampaignCaptureResult =
  | Extract<
      Effect.Success<RegistryCaptureEffect>,
      { readonly status: 'queued' }
    >
  | {
      readonly status: 'synced'
      readonly response: { readonly application: { readonly id: string } }
    }

type CampaignSyncResult = Pick<
  Effect.Success<RegistrySyncEffect>,
  'failed' | 'synced'
>

export type ApplicationRegistryCampaignClient = {
  readonly capture: (
    request: Parameters<RegistryCapture>[0]
  ) => Effect.Effect<CampaignCaptureResult, Effect.Error<RegistryCaptureEffect>>
  readonly list: (
    query: Parameters<ApplicationRegistryClientService['list']>[0]
  ) => Effect.Effect<
    Effect.Success<RegistryListEffect>,
    Effect.Error<RegistryListEffect>
  >
  readonly sync: () => Effect.Effect<
    CampaignSyncResult,
    Effect.Error<RegistrySyncEffect>
  >
}

export type ApplicationRegistryCampaignCaptureRequest = Parameters<
  ApplicationRegistryCampaignClient['capture']
>[0]

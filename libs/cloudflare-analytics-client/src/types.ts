import type * as Redacted from 'effect/Redacted'

export const CLOUDFLARE_GRAPHQL_ENDPOINT =
  'https://api.cloudflare.com/client/v4/graphql'

export type CloudflareAnalyticsEnv = Readonly<
  Record<string, string | undefined>
>

export type CloudflareAnalyticsConfig = {
  readonly apiToken: Redacted.Redacted<string>
  readonly endpoint: string
  readonly host?: string
  readonly zoneId: string
}

export type CloudflareAnalyticsRange = {
  readonly from: string
  readonly host?: string
  readonly to: string
}

export type CloudflareAnalyticsFetch = (
  input: string | URL,
  init?: RequestInit
) => Promise<Response>

export type FetchCloudflareAnalyticsOptions = {
  readonly config: CloudflareAnalyticsConfig
  readonly fetch?: CloudflareAnalyticsFetch
  readonly range: CloudflareAnalyticsRange
}

export type FetchCloudflareAnalyticsFromEnvOptions = {
  readonly endpoint?: string
  readonly env?: CloudflareAnalyticsEnv
  readonly fetch?: CloudflareAnalyticsFetch
  readonly range: CloudflareAnalyticsRange
}

export type GraphqlFilter = {
  readonly AND: ReadonlyArray<Readonly<Record<string, string>>>
}

export type GraphqlVariables = {
  readonly filter: GraphqlFilter
  readonly zoneTag: string
}

import type * as Redacted from 'effect/Redacted'

export const defaultEndpoint = 'https://api.cloudflare.com/client/v4/graphql'

export interface Configuration {
  readonly apiToken: Redacted.Redacted<string>
  readonly endpoint: URL
  readonly host?: string
  readonly zoneId: string
}

export interface Range {
  readonly from: string
  readonly host?: string
  readonly to: string
}

export interface DatasetLimits {
  readonly maxDurationMs: number
  readonly maxPageSize: number
  readonly retentionMs: number
}

/**
 * Exact provider path mapped to an application-owned identifier. The raw path
 * is accepted only at the Cloudflare adapter boundary and is never returned
 * from the client.
 */
export interface PathAlias {
  readonly key: string
  readonly path: string
}

export interface AliasedPathRecord {
  readonly countries: Readonly<Record<string, number>>
  readonly key: string
  readonly series: ReadonlyArray<{
    readonly at: string
    readonly pageViews: number
    readonly visits: number
  }>
  readonly totals: {
    readonly pageViews: number
    readonly visits: number
  }
}

export interface AliasedPathData {
  readonly generatedAt: string
  readonly range: {
    readonly from: string
    readonly granularity: 'day'
    readonly to: string
  }
  readonly records: ReadonlyArray<AliasedPathRecord>
}

export interface ReadAliasedPathsOptions {
  readonly aliases: ReadonlyArray<PathAlias>
  readonly pathLike?: string
  readonly range: Range
}

export interface GraphqlFilter {
  readonly AND: ReadonlyArray<Readonly<Record<string, string>>>
}

export interface GraphqlVariables {
  readonly filter: GraphqlFilter
  readonly zoneTag: string
}

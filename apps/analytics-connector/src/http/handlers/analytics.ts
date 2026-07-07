import type { GrafanaAnalyticsTables } from '@cv/analytics-grafana'
import { Effect } from 'effect'
import { HttpApiBuilder } from 'effect/unstable/httpapi'
import { AnalyticsTables } from '../../services/analytics-tables'
import { AnalyticsConnectorApi } from '../api'
import type { AnalyticsConnectorQuery, VariableRow } from '../schemas'

const uniqueValues = (values: string[]) =>
  Array.from(new Set(values.filter(Boolean))).sort((a, b) => a.localeCompare(b))

const variableRows = (values: string[]): VariableRow[] =>
  uniqueValues(values).map((value) => ({
    label: value,
    value,
  }))

export const AnalyticsHandlersLayer = HttpApiBuilder.group(
  AnalyticsConnectorApi,
  'analytics',
  (handlers) =>
    AnalyticsTables.pipe(
      Effect.map((tables) => {
        const table = <A>(
          query: AnalyticsConnectorQuery,
          select: (tables: GrafanaAnalyticsTables) => A
        ) => tables.load(query).pipe(Effect.map(select))

        const variableTable = (
          query: AnalyticsConnectorQuery,
          select: (tables: GrafanaAnalyticsTables) => string[]
        ) => table(query, (rows) => variableRows(select(rows)))

        return handlers
          .handle('summary', ({ query }) =>
            table(query, (rows) => rows.summary)
          )
          .handle('audiences', ({ query }) =>
            table(query, (rows) => rows.audiences)
          )
          .handle('audienceDaily', ({ query }) =>
            table(query, (rows) => rows.audienceDaily)
          )
          .handle('audienceDimensions', ({ query }) =>
            table(query, (rows) => rows.audienceDimensions)
          )
          .handle('paths', ({ query }) => table(query, (rows) => rows.paths))
          .handle('variableCompanies', ({ query }) =>
            variableTable(query, (rows) =>
              rows.audiences.map((audience) => audience.company)
            )
          )
          .handle('variableLocales', ({ query }) =>
            variableTable(query, (rows) =>
              rows.audiences.map((audience) => audience.locale)
            )
          )
          .handle('variableStages', ({ query }) =>
            variableTable(query, (rows) =>
              rows.audiences.map((audience) => audience.stage)
            )
          )
      })
    )
)

import { Effect } from 'effect'
import { HttpApiBuilder } from 'effect/unstable/httpapi'

import { AnalyticsConnectorApi } from '../api'

export const HealthHandlersLayer = HttpApiBuilder.group(
  AnalyticsConnectorApi,
  'public',
  (handlers) => handlers.handle('health', () => Effect.succeed({ ok: true }))
)

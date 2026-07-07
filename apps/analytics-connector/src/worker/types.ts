export type WorkerExecutionContext = {
  waitUntil: (promise: Promise<unknown>) => void
}

export type AnalyticsConnectorEnv = {
  ANALYTICS_FALLBACK?: 'empty' | 'sample'
  CACHE_TTL_SECONDS?: string
  CLOUDFLARE_ANALYTICS_API_TOKEN?: string
  CLOUDFLARE_GRAPHQL_ENDPOINT?: string
  CLOUDFLARE_ZONE_ID?: string
  PRIVATE_CONTENT_AUDIENCE_KEY?: string
  CV_WEB_HOST?: string
  GRAFANA_CONNECTOR_TOKEN?: string
}

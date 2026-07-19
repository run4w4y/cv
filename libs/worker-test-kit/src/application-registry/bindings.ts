export const applicationRegistryBindings = {
  database: 'APPLICATION_REGISTRY_DB',
  objects: 'CV_OBJECTS',
  sessions: 'CHATGPT_SESSIONS',
} as const

export const applicationRegistryVariables = {
  cloudflareGraphqlEndpoint: 'CLOUDFLARE_GRAPHQL_ENDPOINT',
  cloudflareZoneId: 'CLOUDFLARE_ZONE_ID',
  cvWebHost: 'CV_WEB_HOST',
  listingCheckArchiveEnabled: 'LISTING_CHECK_ARCHIVE_ENABLED',
  listingCheckBatchSize: 'LISTING_CHECK_BATCH_SIZE',
  listingChecksEnabled: 'LISTING_CHECKS_ENABLED',
} as const

export const registryTestToken = 'application-registry-e2e-token'
export const cloudflareAnalyticsTestToken = 'cloudflare-analytics-test-token'

import * as OpenApi from 'effect/unstable/httpapi/OpenApi'

import { ApplicationRegistryApi } from './api'

export const applicationRegistryOpenApi = OpenApi.fromApi(
  ApplicationRegistryApi
)

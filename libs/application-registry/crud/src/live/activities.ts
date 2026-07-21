import { Layer } from 'effect'
import type { RegistryDatabase } from '../internal/connection'
import {
  listActivities,
  listApplicationActivities,
} from '../persistence/activities'
import { ActivitiesCrud } from '../services/activities'

export const makeActivitiesCrudLive = (database: RegistryDatabase) =>
  Layer.succeed(ActivitiesCrud, {
    list: (resolved) => listActivities(database, resolved),
    listByApplication: (applicationId) =>
      listApplicationActivities(database, applicationId),
  })

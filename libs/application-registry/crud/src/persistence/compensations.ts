import { applicationCompensations } from '@cv/application-registry-entity'
import { eq } from 'drizzle-orm'
import { Effect } from 'effect'

import { databaseFailure } from '../errors'
import type { RegistryExecutor } from '../internal/connection'

export const listCompensations = (
  database: RegistryExecutor,
  applicationId: string
) =>
  database
    .select()
    .from(applicationCompensations)
    .where(eq(applicationCompensations.applicationId, applicationId))
    .orderBy(applicationCompensations.kind, applicationCompensations.id)
    .pipe(
      Effect.mapError(
        databaseFailure('Failed to list application compensation')
      )
    )

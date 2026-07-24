import {
  applicationArtifacts,
  applications,
  idempotencyReceipts,
} from '@cv/application-registry-entity'
import { desc, eq } from 'drizzle-orm'
import { Effect } from 'effect'

import { databaseFailure, RegistryDatabaseError } from '../errors'
import type { RegistryDatabase, RegistryExecutor } from '../internal/connection'
import type { PersistedUploadedApplicationArtifact } from '../types'
import { runTransaction } from './shared'

const first = <A>(rows: readonly A[]) => rows.at(0)

export const findApplicationArtifact = (
  database: RegistryExecutor,
  id: string
) =>
  database
    .select()
    .from(applicationArtifacts)
    .where(eq(applicationArtifacts.id, id))
    .limit(1)
    .pipe(
      Effect.map(first),
      Effect.mapError(databaseFailure('Failed to load application artifact'))
    )

export const findApplicationArtifactByGeneratedArtifactId = (
  database: RegistryExecutor,
  generatedArtifactId: string
) =>
  database
    .select()
    .from(applicationArtifacts)
    .where(eq(applicationArtifacts.generatedArtifactId, generatedArtifactId))
    .limit(1)
    .pipe(
      Effect.map(first),
      Effect.mapError(
        databaseFailure('Failed to load generated application artifact')
      )
    )

export const listApplicationArtifacts = (
  database: RegistryExecutor,
  applicationId: string
) =>
  database
    .select()
    .from(applicationArtifacts)
    .where(eq(applicationArtifacts.applicationId, applicationId))
    .orderBy(
      desc(applicationArtifacts.createdAt),
      desc(applicationArtifacts.id)
    )
    .pipe(
      Effect.mapError(databaseFailure('Failed to list application artifacts'))
    )

export const persistUploadedApplicationArtifact = (
  database: RegistryDatabase,
  applicationId: string,
  input: PersistedUploadedApplicationArtifact
) =>
  runTransaction(database, 'application artifact', (transaction) =>
    Effect.gen(function* () {
      const current = yield* transaction
        .select({ id: applications.id })
        .from(applications)
        .where(eq(applications.id, applicationId))
        .for('update')
        .limit(1)

      if (current.length === 0) {
        return yield* new RegistryDatabaseError({
          cause: new Error(`Application ${applicationId} does not exist.`),
          message: 'Failed to attach application artifact',
        })
      }

      yield* transaction.insert(idempotencyReceipts).values({
        applicationId,
        createdAt: input.artifact.createdAt,
        idempotencyKey: input.idempotencyKey,
        requestHash: input.requestHash,
        resourceId: input.artifact.id,
        scope: 'application_artifact',
      })
      yield* transaction.insert(applicationArtifacts).values(input.artifact)
    })
  )

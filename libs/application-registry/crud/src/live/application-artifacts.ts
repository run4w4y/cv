import { Layer } from 'effect'

import type { RegistryDatabase } from '../internal/connection'
import {
  findApplicationArtifact,
  findApplicationArtifactByGeneratedArtifactId,
  listApplicationArtifacts,
  persistUploadedApplicationArtifact,
} from '../persistence/application-artifacts'
import { ApplicationArtifactsCrud } from '../services/application-artifacts'

export const makeApplicationArtifactsCrudLive = (database: RegistryDatabase) =>
  Layer.succeed(ApplicationArtifactsCrud, {
    find: (id) => findApplicationArtifact(database, id),
    findByGeneratedArtifactId: (generatedArtifactId) =>
      findApplicationArtifactByGeneratedArtifactId(
        database,
        generatedArtifactId
      ),
    listByApplication: (applicationId) =>
      listApplicationArtifacts(database, applicationId),
    persistUploaded: (applicationId, input) =>
      persistUploadedApplicationArtifact(database, applicationId, input),
  })

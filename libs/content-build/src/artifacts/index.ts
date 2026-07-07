import type { ContentContract, ContentRegistry } from '@cv/content-composer'
import type {
  PrivateCryptoError,
  WebCryptoApi,
} from '@cv/private-content-crypto'
import {
  buildPrivateRuntimeManifest,
  emptyPrivateRuntimeManifest,
  type PrivateRuntimeManifest,
} from '@cv/private-content-protocol'
import { Effect, type Crypto as PlatformCrypto } from 'effect'
import type { FileSystem } from 'effect/FileSystem'
import type { Path } from 'effect/Path'
import {
  type ContentBuildFileSystemError,
  ContentBuildParseError,
  type ContentBuildUsageError,
} from '../errors'
import {
  indexContentFiles,
  planContentFiles,
  writeContentFiles,
} from '../files/build'
import type {
  ContentFileIndex,
  ContentFileOutputPaths,
  ContentFilePlan,
} from '../files/model'
import {
  type BuildContentSnapshotOptions,
  buildContentSnapshot,
  type ContentBuildSnapshot,
} from '../source/snapshot'

export type ContentArtifactPaths = ContentFileOutputPaths

export type BuildContentArtifactsOptions = Pick<
  BuildContentSnapshotOptions,
  'config' | 'includeAllPublicProfiles' | 'privateSecrets' | 'strictPrivate'
>

export type ContentArtifacts = {
  fileIndex: ContentFileIndex
  filePlan: ContentFilePlan
  privateManifest: PrivateRuntimeManifest
  snapshot: ContentBuildSnapshot
}

const buildRuntimeManifest = (
  snapshot: ContentBuildSnapshot
): Effect.Effect<
  PrivateRuntimeManifest,
  ContentBuildParseError | PrivateCryptoError,
  WebCryptoApi | PlatformCrypto.Crypto
> =>
  snapshot.privateRuntimeInput
    ? buildPrivateRuntimeManifest(snapshot.privateRuntimeInput).pipe(
        Effect.mapError(
          (cause) =>
            new ContentBuildParseError({
              cause,
              context: 'Private runtime manifest',
              message: 'Could not build private runtime manifest',
            })
        )
      )
    : Effect.succeed(emptyPrivateRuntimeManifest())

export const buildContentArtifacts = (
  registry: ContentRegistry,
  contract: ContentContract,
  {
    config,
    includeAllPublicProfiles = false,
    privateSecrets = null,
    strictPrivate = false,
  }: BuildContentArtifactsOptions
): Effect.Effect<
  ContentArtifacts,
  | ContentBuildFileSystemError
  | ContentBuildParseError
  | ContentBuildUsageError
  | PrivateCryptoError,
  FileSystem | Path | WebCryptoApi | PlatformCrypto.Crypto
> =>
  buildContentSnapshot(registry, contract, {
    config,
    includeAllPublicProfiles,
    privateSecrets,
    strictPrivate,
  }).pipe(
    Effect.flatMap((snapshot) =>
      buildRuntimeManifest(snapshot).pipe(
        Effect.flatMap((privateManifest) =>
          planContentFiles({
            contentIdSalt: snapshot.contentIdSalt,
            contentRoot: snapshot.contentFilesRoot,
            profiles: snapshot.profiles,
            privateRuntimeInput: snapshot.privateRuntimeInput,
          }).pipe(
            Effect.map((filePlan) => ({
              fileIndex: indexContentFiles(
                filePlan.files,
                filePlan.contentIdSalt
              ),
              filePlan,
              privateManifest,
              snapshot,
            }))
          )
        )
      )
    )
  )

export const writeContentArtifactFiles = (
  artifacts: ContentArtifacts,
  paths: ContentArtifactPaths
) => writeContentFiles({ ...artifacts.filePlan, ...paths })

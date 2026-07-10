import type { PrivateRuntimeBuildInput } from '@cv/private-content-protocol'

export { type ContentFileIndex, emptyContentFileIndex } from '@cv/content-core'

export type ContentFileScope = 'private' | 'public'

export type ContentFile = {
  profile?: string
  relativePath: string
  scope: ContentFileScope
  sourcePath: string
}

export type DiscoverContentFilesOptions = {
  profiles: readonly string[]
}

export type PlanContentFilesOptions = {
  contentIdSalt: string
  contentRoot: string
  profiles: readonly string[]
  privateRuntimeInput: PrivateRuntimeBuildInput | null
}

export type ContentFilePlan = {
  contentIdSalt: string
  files: readonly ContentFile[]
  privateRuntimeInput: PrivateRuntimeBuildInput | null
}

export type ContentFileOutputPaths = {
  outputRootDir: string
  privateFilesDir: string
  publicFilesDir: string
}

export type WriteContentFilesOptions = ContentFilePlan & ContentFileOutputPaths

export const contentFilesDirectoryName = 'files'
export const profileFilesDirectoryName = '_files'
export const profileRootDirectoryName = 'profiles'
export const privateFilesDirectoryName = 'private'
export const publicFilesDirectoryName = 'public'

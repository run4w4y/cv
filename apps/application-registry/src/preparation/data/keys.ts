import type { ContentEntryKind } from '@cv/application-registry-entity'
import type { CvLocale } from '@cv/contracts/facts'

export type PreparationIdentity = {
  readonly applicationId: string
  readonly kind: ContentEntryKind
  readonly locale: CvLocale
}

export type PreparationContextIdentity = {
  readonly applicationId: string
  readonly locale: CvLocale
}

export type ContentHeadIdentity = {
  readonly applicationId: string
  readonly entryId: string
  readonly revisionId: string | null
}

export type PublicationIdentity = {
  readonly applicationId: string
  readonly entryId: string
  readonly rendererVersion?: string | undefined
}

const encodePart = (value: string): string => encodeURIComponent(value)

export const preparationIdentityKey = (identity: PreparationIdentity): string =>
  [identity.applicationId, identity.kind, identity.locale]
    .map(encodePart)
    .join('/')

export const preparationContextIdentityKey = (
  identity: PreparationContextIdentity
): string => [identity.applicationId, identity.locale].map(encodePart).join('/')

export const contentHeadIdentityKey = (identity: ContentHeadIdentity): string =>
  [
    identity.applicationId,
    identity.entryId,
    identity.revisionId === null
      ? 'revision:none'
      : `revision:some:${identity.revisionId}`,
  ]
    .map(encodePart)
    .join('/')

export const publicationIdentityKey = (identity: PublicationIdentity): string =>
  [
    identity.applicationId,
    identity.entryId,
    identity.rendererVersion === undefined
      ? 'renderer:none'
      : `renderer:some:${identity.rendererVersion}`,
  ]
    .map(encodePart)
    .join('/')

export const preparationReactivity = {
  application: (applicationId: string) =>
    `registry:applications:${applicationId}`,
  facts: (locale: CvLocale) => `registry:facts:${locale}`,
  snapshot: (applicationId: string) =>
    `registry:applications:${applicationId}:job-snapshot`,
  entry: (identity: PreparationIdentity) =>
    `registry:applications:${identity.applicationId}:content:${identity.kind}:${identity.locale}`,
  content: (applicationId: string, entryId: string) =>
    `registry:applications:${applicationId}:content:${entryId}`,
  publication: (applicationId: string, entryId: string) =>
    `registry:applications:${applicationId}:content:${entryId}:publication`,
  pdf: (applicationId: string, entryId: string) =>
    `registry:applications:${applicationId}:content:${entryId}:pdf`,
} as const

export const preparationContextReactivityKeys = (
  identity: PreparationContextIdentity
) => [
  preparationReactivity.application(identity.applicationId),
  preparationReactivity.snapshot(identity.applicationId),
  preparationReactivity.facts(identity.locale),
]

export const preparationBootstrapReactivityKeys = (
  identity: PreparationIdentity
) => [
  ...preparationContextReactivityKeys(identity),
  preparationReactivity.entry(identity),
]

export const contentMutationReactivityKeys = (
  identity: PreparationIdentity,
  entryId: string
) => [
  preparationReactivity.application(identity.applicationId),
  preparationReactivity.entry(identity),
  preparationReactivity.content(identity.applicationId, entryId),
]

export const publicationMutationReactivityKeys = (
  applicationId: string,
  entryId: string
) => [
  preparationReactivity.content(applicationId, entryId),
  preparationReactivity.publication(applicationId, entryId),
  preparationReactivity.pdf(applicationId, entryId),
]

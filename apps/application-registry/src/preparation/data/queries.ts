import { Effect } from 'effect'
import * as Atom from 'effect/unstable/reactivity/Atom'

import {
  type ContentHeadIdentity,
  contentHeadIdentityKey,
  type PreparationContextIdentity,
  type PreparationIdentity,
  type PublicationIdentity,
  preparationBootstrapReactivityKeys,
  preparationContextIdentityKey,
  preparationContextReactivityKeys,
  preparationIdentityKey,
  preparationReactivity,
  publicationIdentityKey,
} from './keys'
import { PreparationRepository } from './repository'
import { preparationDataRuntime } from './runtime'

const contextInputs = new Map<string, PreparationContextIdentity>()
const contextFamily = Atom.family((key: string) => {
  const input = contextInputs.get(key)
  if (input === undefined) {
    throw new Error(`Missing preparation context atom input for ${key}.`)
  }
  return preparationDataRuntime
    .atom(
      PreparationRepository.use((repository) => repository.loadContext(input))
    )
    .pipe(
      preparationDataRuntime.factory.withReactivity(
        preparationContextReactivityKeys(input)
      )
    )
})

/** Stable context query keyed by application and facts locale. */
export const preparationContextAtom = (input: PreparationContextIdentity) => {
  const key = preparationContextIdentityKey(input)
  contextInputs.set(key, input)
  try {
    return contextFamily(key)
  } finally {
    contextInputs.delete(key)
  }
}

const revisionInputs = new Map<string, ContentHeadIdentity>()
const revisionFamily = Atom.family((key: string) => {
  const input = revisionInputs.get(key)
  if (input === undefined) {
    throw new Error(`Missing content revision atom input for ${key}.`)
  }
  return preparationDataRuntime
    .atom(
      PreparationRepository.use((repository) =>
        repository.loadContentHead(input)
      )
    )
    .pipe(
      preparationDataRuntime.factory.withReactivity([
        preparationReactivity.content(input.applicationId, input.entryId),
      ])
    )
})

/** Stable immutable-revision query; a null revision resolves to null. */
export const contentRevisionAtom = (input: ContentHeadIdentity) => {
  const key = contentHeadIdentityKey(input)
  revisionInputs.set(key, input)
  try {
    return revisionFamily(key)
  } finally {
    revisionInputs.delete(key)
  }
}

const headInputs = new Map<string, PreparationIdentity>()
const headFamily = Atom.family((key: string) => {
  const input = headInputs.get(key)
  if (input === undefined) {
    throw new Error(`Missing content head atom input for ${key}.`)
  }
  return preparationDataRuntime
    .atom(
      PreparationRepository.use((repository) =>
        repository.loadPreparationHead(input)
      )
    )
    .pipe(
      preparationDataRuntime.factory.withReactivity([
        preparationReactivity.entry(input),
      ])
    )
})

/** Stable live content-head query keyed by application, kind, and locale. */
export const contentHeadAtom = (input: PreparationIdentity) => {
  const key = preparationIdentityKey(input)
  headInputs.set(key, input)
  try {
    return headFamily(key)
  } finally {
    headInputs.delete(key)
  }
}

const bootstrapInputs = new Map<string, PreparationIdentity>()
const bootstrapFamily = Atom.family((key: string) => {
  const input = bootstrapInputs.get(key)
  if (input === undefined) {
    throw new Error(`Missing preparation bootstrap atom input for ${key}.`)
  }
  return preparationDataRuntime
    .atom(
      PreparationRepository.use((repository) => repository.loadBootstrap(input))
    )
    .pipe(
      preparationDataRuntime.factory.withReactivity(
        preparationBootstrapReactivityKeys(input)
      )
    )
})

/** Stable preparation bootstrap keyed by application, document kind, and locale. */
export const preparationBootstrapAtom = (input: PreparationIdentity) => {
  const key = preparationIdentityKey(input)
  bootstrapInputs.set(key, input)
  try {
    return bootstrapFamily(key)
  } finally {
    bootstrapInputs.delete(key)
  }
}

const modelsFamily = Atom.family((enabled: boolean) =>
  preparationDataRuntime
    .atom(
      enabled
        ? PreparationRepository.use((repository) => repository.discoverModels())
        : Effect.succeed([])
    )
    .pipe(
      preparationDataRuntime.factory.withReactivity([
        preparationReactivity.models,
      ])
    )
)

/** Model discovery stays dormant until the external ChatGPT session is ready. */
export const preparationModelsAtom = (enabled: boolean) => modelsFamily(enabled)

const publicationInputs = new Map<string, PublicationIdentity>()
const publicationFamily = Atom.family((key: string) => {
  const input = publicationInputs.get(key)
  if (input === undefined) {
    throw new Error(`Missing publication atom input for ${key}.`)
  }
  return preparationDataRuntime
    .atom(
      PreparationRepository.use((repository) =>
        repository.loadPublishedCvState(input)
      )
    )
    .pipe(
      preparationDataRuntime.factory.withReactivity([
        preparationReactivity.publication(input.applicationId, input.entryId),
        preparationReactivity.pdf(input.applicationId, input.entryId),
      ])
    )
})

/** Stable publication read model keyed by entry and optional renderer version. */
export const publishedCvStateAtom = (input: PublicationIdentity) => {
  const key = publicationIdentityKey(input)
  publicationInputs.set(key, input)
  try {
    return publicationFamily(key)
  } finally {
    publicationInputs.delete(key)
  }
}

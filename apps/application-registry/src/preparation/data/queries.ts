import * as Atom from 'effect/unstable/reactivity/Atom'

import {
  type ContentHeadIdentity,
  type PreparationContextIdentity,
  type PreparationIdentity,
  type PublicationIdentity,
  preparationBootstrapReactivityKeys,
  preparationContextReactivityKeys,
  preparationReactivity,
} from './keys'
import { PreparationRepository } from './repository'
import { preparationDataRuntime } from './runtime'

const contextFamily = Atom.family((input: PreparationContextIdentity) =>
  preparationDataRuntime
    .atom(
      PreparationRepository.use((repository) => repository.loadContext(input))
    )
    .pipe(
      preparationDataRuntime.factory.withReactivity(
        preparationContextReactivityKeys(input)
      )
    )
)

/** Stable context query keyed by application and facts locale. */
export const preparationContextAtom = (input: PreparationContextIdentity) =>
  contextFamily(input)

const revisionFamily = Atom.family((input: ContentHeadIdentity) =>
  preparationDataRuntime
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
)

/** Stable immutable-revision query; a null revision resolves to null. */
export const contentRevisionAtom = (input: ContentHeadIdentity) =>
  revisionFamily(input)

const headFamily = Atom.family((input: PreparationIdentity) =>
  preparationDataRuntime
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
)

/** Stable live content-head query keyed by application, kind, and locale. */
export const contentHeadAtom = (input: PreparationIdentity) => headFamily(input)

const bootstrapFamily = Atom.family((input: PreparationIdentity) =>
  preparationDataRuntime
    .atom(
      PreparationRepository.use((repository) => repository.loadBootstrap(input))
    )
    .pipe(
      preparationDataRuntime.factory.withReactivity(
        preparationBootstrapReactivityKeys(input)
      )
    )
)

/** Stable preparation bootstrap keyed by application, document kind, and locale. */
export const preparationBootstrapAtom = (input: PreparationIdentity) =>
  bootstrapFamily(input)

/** Active release-wide CV generation guidance. */
export const activeCvGenerationGuidanceAtom = preparationDataRuntime.atom(
  PreparationRepository.use((repository) =>
    repository.loadCvGenerationGuidance()
  )
)

const publicationFamily = Atom.family((input: PublicationIdentity) =>
  preparationDataRuntime
    .atom(
      PreparationRepository.use((repository) =>
        repository.loadCvPageState(input)
      )
    )
    .pipe(
      preparationDataRuntime.factory.withReactivity([
        preparationReactivity.publication(input.applicationId, input.entryId),
        preparationReactivity.pdf(input.applicationId, input.entryId),
      ])
    )
)

/** Stable publication read model keyed by entry and optional renderer version. */
export const cvPageStateAtom = (input: PublicationIdentity) =>
  publicationFamily(input)

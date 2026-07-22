import { Option } from 'effect'
import * as Atom from 'effect/unstable/reactivity/Atom'

import type {
  EditPreparationDraftInput,
  PreparationEditorIdentity,
  PreparationEditorLocalState,
  RecordPreparationSaveInput,
  ReleaseDetachedPreparationWorkflowInput,
} from './model'

export const preparationEditorKey = (
  identity: PreparationEditorIdentity
): string =>
  JSON.stringify([identity.applicationId, identity.kind, identity.locale])

const initialLocalState = (): PreparationEditorLocalState => ({
  humanDraft: Option.none(),
  lastMutationResult: null,
  releasedDetachedCandidateRevisionId: null,
})

const localStateFamily = Atom.family((identity: PreparationEditorIdentity) => {
  const key = preparationEditorKey(identity)
  return Atom.make(initialLocalState()).pipe(
    Atom.keepAlive,
    Atom.withLabel(`preparation/editor/local/${key}`)
  )
})

/** Canonicalizes object input so rerenders do not create object-identity atoms. */
export const preparationEditorLocalStateAtom = (
  identity: PreparationEditorIdentity
) => localStateFamily(identity)

export const editPreparationDraftAtom =
  Atom.fnSync<EditPreparationDraftInput>()((input, get) => {
    const stateAtom = localStateFamily(input.identity)
    const current = get(stateAtom)
    get.set(stateAtom, {
      ...current,
      humanDraft: Option.some(input.document),
    })
  })

export const recordPreparationSaveAtom =
  Atom.fnSync<RecordPreparationSaveInput>()((input, get) => {
    const stateAtom = localStateFamily(input.identity)
    const current = get(stateAtom)
    get.set(stateAtom, {
      ...current,
      humanDraft: Option.none(),
      lastMutationResult: input.revision,
    })
  })

/** Requires an explicit product decision before detached work becomes direct. */
export const releaseDetachedPreparationWorkflowAtom =
  Atom.fnSync<ReleaseDetachedPreparationWorkflowInput>()((input, get) => {
    const stateAtom = localStateFamily(input.identity)
    const current = get(stateAtom)
    if (
      current.releasedDetachedCandidateRevisionId === input.candidateRevisionId
    ) {
      return false
    }
    get.set(stateAtom, {
      ...current,
      releasedDetachedCandidateRevisionId: input.candidateRevisionId,
    })
    return true
  })

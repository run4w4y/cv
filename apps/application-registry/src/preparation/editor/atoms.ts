import { Option } from 'effect'
import * as Atom from 'effect/unstable/reactivity/Atom'

import type {
  EditPreparationDraftInput,
  PreparationEditorIdentity,
  PreparationEditorLocalState,
  RecordPreparationSaveInput,
  ReleaseDetachedPreparationWorkflowInput,
  SetPreparationLayoutAssessmentInput,
} from './model'
import { preparationDocumentFingerprint } from './session'

export const preparationEditorKey = (
  identity: PreparationEditorIdentity
): string =>
  JSON.stringify([identity.applicationId, identity.kind, identity.locale])

export const preparationEditorIdentityFromKey = (
  key: string
): PreparationEditorIdentity => {
  const decoded: unknown = JSON.parse(key)
  if (
    !Array.isArray(decoded) ||
    decoded.length !== 3 ||
    typeof decoded[0] !== 'string' ||
    (decoded[1] !== 'cv' && decoded[1] !== 'cover_letter') ||
    typeof decoded[2] !== 'string'
  ) {
    throw new Error(`Invalid preparation editor key: ${key}`)
  }
  return {
    applicationId: decoded[0],
    kind: decoded[1],
    locale: decoded[2],
  }
}

const initialLocalState = (): PreparationEditorLocalState => ({
  humanDraft: Option.none(),
  lastMutationResult: null,
  layoutAssessment: null,
  layoutDocumentFingerprint: null,
  releasedDetachedCandidateRevisionId: null,
})

const localStateFamily = Atom.family((key: string) => {
  preparationEditorIdentityFromKey(key)
  return Atom.make(initialLocalState()).pipe(
    Atom.keepAlive,
    Atom.withLabel(`preparation/editor/local/${key}`)
  )
})

/** Canonicalizes object input so rerenders do not create object-identity atoms. */
export const preparationEditorLocalStateAtom = (
  identity: PreparationEditorIdentity
) => localStateFamily(preparationEditorKey(identity))

export const editPreparationDraftAtom =
  Atom.fnSync<EditPreparationDraftInput>()((input, get) => {
    const stateAtom = localStateFamily(preparationEditorKey(input.identity))
    const current = get(stateAtom)
    get.set(stateAtom, {
      ...current,
      humanDraft: Option.some(input.document),
      layoutAssessment: null,
      layoutDocumentFingerprint: null,
    })
  })

export const recordPreparationSaveAtom =
  Atom.fnSync<RecordPreparationSaveInput>()((input, get) => {
    const stateAtom = localStateFamily(preparationEditorKey(input.identity))
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
    const stateAtom = localStateFamily(preparationEditorKey(input.identity))
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

export const setPreparationLayoutAssessmentAtom =
  Atom.fnSync<SetPreparationLayoutAssessmentInput>()((input, get) => {
    const stateAtom = localStateFamily(preparationEditorKey(input.identity))
    const current = get(stateAtom)
    const fingerprint = preparationDocumentFingerprint(input.document)
    if (
      current.layoutAssessment === input.assessment &&
      current.layoutDocumentFingerprint === fingerprint
    ) {
      return
    }
    get.set(stateAtom, {
      ...current,
      layoutAssessment: input.assessment,
      layoutDocumentFingerprint: fingerprint,
    })
  })

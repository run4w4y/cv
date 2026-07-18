import type { CvLink, PublishedCvState } from './api'

export type CvPublicationViewState = {
  readonly entryId: string | null
  readonly publication: PublishedCvState | null
}

export type CvPublicationViewAction =
  | { readonly type: 'select-entry'; readonly entryId: string | null }
  | {
      readonly type: 'publication-loaded'
      readonly entryId: string
      readonly publication: PublishedCvState | null
    }
  | { readonly type: 'link-updated'; readonly link: CvLink }

export const initialCvPublicationViewState: CvPublicationViewState = {
  entryId: null,
  publication: null,
}

/**
 * Keeps the live publication attached to its content entry, independently of
 * whichever revision is currently open in the editor.
 */
export const reduceCvPublicationViewState = (
  state: CvPublicationViewState,
  action: CvPublicationViewAction
): CvPublicationViewState => {
  switch (action.type) {
    case 'select-entry':
      return action.entryId === state.entryId
        ? state
        : { entryId: action.entryId, publication: null }
    case 'publication-loaded':
      return action.entryId === state.entryId
        ? { ...state, publication: action.publication }
        : state
    case 'link-updated':
      return state.publication?.link.id === action.link.id
        ? {
            ...state,
            publication: { ...state.publication, link: action.link },
          }
        : state
  }
}

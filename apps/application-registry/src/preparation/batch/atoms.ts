import * as Atom from 'effect/unstable/reactivity/Atom'

import {
  canonicalPreparationUrl,
  type DocumentKind,
  maximumPreparationBatchSize,
} from '../workflow/domain'

export type BatchPreparationForm = {
  readonly kind: DocumentKind
  readonly locale: string
  readonly prompt: string
  readonly urls: string
}

export const initialBatchPreparationForm: BatchPreparationForm = {
  kind: 'cv',
  locale: 'en',
  prompt: 'Write a concise, specific, professional cover letter.',
  urls: '',
}

export const batchPreparationFormAtom = Atom.make(initialBatchPreparationForm)

/** Atomically prevents duplicate batch launches before React can rerender. */
export const batchPreparationCommandGateAtom = Atom.make(false).pipe(
  Atom.withLabel('preparation/batch/command-gate')
)

export const parsedBatchUrlsAtom = Atom.make((get) => {
  const { urls } = get(batchPreparationFormAtom)
  return [
    ...new Set(
      urls
        .split(/[\n,]/u)
        .map((url) => url.trim())
        .filter(Boolean)
        .map((url) => {
          try {
            return canonicalPreparationUrl(url)
          } catch {
            return url
          }
        })
    ),
  ]
})

export const batchPreparationValidationAtom = Atom.make((get) => {
  const form = get(batchPreparationFormAtom)
  const urls = get(parsedBatchUrlsAtom)
  const tooLarge = urls.length > maximumPreparationBatchSize
  const promptMissing =
    form.kind === 'cover_letter' && form.prompt.trim().length === 0
  return {
    canStart:
      urls.length > 0 &&
      !tooLarge &&
      form.locale.trim().length > 0 &&
      !promptMissing,
    promptMissing,
    tooLarge,
    urls,
  } as const
})

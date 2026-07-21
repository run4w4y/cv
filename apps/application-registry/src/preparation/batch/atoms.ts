import {
  canonicalPreparationUrl,
  type DocumentKind,
  HttpUrlSchema,
  maximumCoverLetterPromptLength,
  maximumPreparationBatchSize,
} from '@cv/application-preparation-workflow/domain'
import { Result, Schema, SchemaIssue } from 'effect'
import * as Atom from 'effect/unstable/reactivity/Atom'

export type BatchPreparationForm = {
  readonly kind: DocumentKind
  readonly locale: string
  readonly prompt: string
  readonly urls: string
}

export const initialBatchPreparationForm: BatchPreparationForm = {
  kind: 'cv',
  locale: '',
  prompt: 'Write a concise, specific, professional cover letter.',
  urls: '',
}

export const batchPreparationFormAtom = Atom.make(initialBatchPreparationForm)

/** Atomically prevents duplicate batch launches before React can rerender. */
export const batchPreparationCommandGateAtom = Atom.make(false).pipe(
  Atom.withLabel('preparation/batch/command-gate')
)

export const batchPreparationStepAtom = Atom.make<1 | 2 | 3>(1).pipe(
  Atom.withLabel('preparation/batch/step')
)

export type BatchPreparationUrlRow = {
  readonly canonicalUrl: string | null
  readonly duplicateOf: number | null
  readonly line: number
  readonly message: string | null
  readonly value: string
}

const urlIssueFormatter = SchemaIssue.makeFormatterStandardSchemaV1()

const validateUrl = (
  value: string
): { readonly url: string } | { readonly message: string } => {
  const result = Schema.decodeUnknownResult(HttpUrlSchema)(value)
  if (Result.isSuccess(result)) {
    return { url: canonicalPreparationUrl(result.success) }
  }

  const formatted = urlIssueFormatter(result.failure.issue)
  return {
    message:
      formatted.issues[0]?.message ?? 'Enter a valid absolute HTTP(S) URL.',
  }
}

export const batchPreparationUrlRowsAtom = Atom.make((get) => {
  const { urls } = get(batchPreparationFormAtom)
  const firstLineByUrl = new Map<string, number>()
  const rows: Array<BatchPreparationUrlRow> = []

  for (const [index, rawLine] of urls.split(/\r?\n/u).entries()) {
    const value = rawLine.trim()
    if (value.length === 0) continue

    const validated = validateUrl(value)
    if ('message' in validated) {
      rows.push({
        canonicalUrl: null,
        duplicateOf: null,
        line: index + 1,
        message: validated.message,
        value,
      })
      continue
    }

    const duplicateOf = firstLineByUrl.get(validated.url) ?? null
    if (duplicateOf === null) firstLineByUrl.set(validated.url, index + 1)

    rows.push({
      canonicalUrl: validated.url,
      duplicateOf,
      line: index + 1,
      message:
        duplicateOf === null
          ? null
          : `Duplicate of line ${duplicateOf}; it will only run once.`,
      value,
    })
  }

  return rows
})

export const parsedBatchUrlsAtom = Atom.make((get) => {
  const rows = get(batchPreparationUrlRowsAtom)
  return rows.flatMap((row) =>
    row.canonicalUrl !== null && row.duplicateOf === null
      ? [row.canonicalUrl]
      : []
  )
})

export const batchPreparationValidationAtom = Atom.make((get) => {
  const form = get(batchPreparationFormAtom)
  const rows = get(batchPreparationUrlRowsAtom)
  const urls = get(parsedBatchUrlsAtom)
  const tooLarge = urls.length > maximumPreparationBatchSize
  const invalidUrls = rows.filter((row) => row.canonicalUrl === null)
  const promptMissing =
    form.kind === 'cover_letter' && form.prompt.trim().length === 0
  const promptTooLong =
    form.kind === 'cover_letter' &&
    form.prompt.length > maximumCoverLetterPromptLength
  const urlsValid = urls.length > 0 && invalidUrls.length === 0 && !tooLarge
  const settingsValid =
    form.locale.length > 0 && !promptMissing && !promptTooLong

  return {
    canStart: urlsValid && settingsValid,
    invalidUrls,
    promptCharactersRemaining:
      maximumCoverLetterPromptLength - form.prompt.length,
    promptMissing,
    promptTooLong,
    rows,
    settingsValid,
    tooLarge,
    urls,
    urlsValid,
  } as const
})

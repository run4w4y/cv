import {
  type AiWorkflowTarget,
  canonicalPreparationUrl,
  HttpUrlSchema,
  maximumCoverLetterPromptLength,
  maximumPreparationBatchSize,
} from '@cv/application-preparation-workflow/domain'
import { Result, Schema, SchemaIssue } from 'effect'
import * as Atom from 'effect/unstable/reactivity/Atom'
import {
  coverLetterPromptAtom,
  initialCoverLetterPrompt,
} from '@/preparation/forms/atoms'

export type BatchPreparationForm = {
  readonly includeCoverLetter: boolean
  readonly locale: string
  readonly postingUrls: string
  readonly prompt: string
}

export const initialBatchPreparationForm: BatchPreparationForm = {
  includeCoverLetter: true,
  locale: '',
  postingUrls: '',
  prompt: initialCoverLetterPrompt,
}

const batchPreparationFieldsAtom = Atom.make({
  includeCoverLetter: initialBatchPreparationForm.includeCoverLetter,
  locale: initialBatchPreparationForm.locale,
  postingUrls: initialBatchPreparationForm.postingUrls,
})

export const batchPreparationFormAtom = Atom.writable<
  BatchPreparationForm,
  BatchPreparationForm
>(
  (get): BatchPreparationForm => ({
    ...get(batchPreparationFieldsAtom),
    prompt: get(coverLetterPromptAtom),
  }),
  (context, form) => {
    context.set(batchPreparationFieldsAtom, {
      includeCoverLetter: form.includeCoverLetter,
      locale: form.locale,
      postingUrls: form.postingUrls,
    })
    if (form.prompt !== context.get(coverLetterPromptAtom)) {
      context.set(coverLetterPromptAtom, form.prompt)
    }
  }
)

/** Atomically prevents duplicate batch launches before React can rerender. */
export const batchPreparationCommandGateAtom = Atom.make(false).pipe(
  Atom.withLabel('preparation/batch/command-gate')
)

export const batchPreparationStepAtom = Atom.make<1 | 2 | 3>(1).pipe(
  Atom.withLabel('preparation/batch/step')
)

export type BatchPreparationPostingUrlRow = {
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

export const batchPreparationPostingUrlRowsAtom = Atom.make((get) => {
  const { postingUrls } = get(batchPreparationFormAtom)
  const firstLineByUrl = new Map<string, number>()
  const rows: Array<BatchPreparationPostingUrlRow> = []

  for (const [index, rawLine] of postingUrls.split(/\r?\n/u).entries()) {
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

export const parsedBatchPostingTargetsAtom = Atom.make((get) => {
  const rows = get(batchPreparationPostingUrlRowsAtom)
  return rows.flatMap(
    (row): ReadonlyArray<AiWorkflowTarget> =>
      row.canonicalUrl !== null && row.duplicateOf === null
        ? [{ _tag: 'PostingUrl', url: row.canonicalUrl }]
        : []
  )
})

export const batchPreparationValidationAtom = Atom.make((get) => {
  const form = get(batchPreparationFormAtom)
  const rows = get(batchPreparationPostingUrlRowsAtom)
  const targets = get(parsedBatchPostingTargetsAtom)
  const tooLarge = targets.length > maximumPreparationBatchSize
  const invalidUrls = rows.filter((row) => row.canonicalUrl === null)
  const promptMissing =
    form.includeCoverLetter && form.prompt.trim().length === 0
  const promptTooLong =
    form.includeCoverLetter &&
    form.prompt.length > maximumCoverLetterPromptLength
  const targetsValid =
    targets.length > 0 && invalidUrls.length === 0 && !tooLarge
  const settingsValid =
    form.locale.length > 0 && !promptMissing && !promptTooLong

  return {
    canStart: targetsValid && settingsValid,
    invalidUrls,
    promptCharactersRemaining:
      maximumCoverLetterPromptLength - form.prompt.length,
    promptMissing,
    promptTooLong,
    rows,
    settingsValid,
    targets,
    targetsValid,
    tooLarge,
  } as const
})

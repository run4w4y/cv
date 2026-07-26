import { CoverLetterArtifactRequestSchema } from '@cv/application-preparation-workflow/domain'
import * as BrowserKeyValueStore from '@effect/platform-browser/BrowserKeyValueStore'
import * as Atom from 'effect/unstable/reactivity/Atom'

export const coverLetterPromptStorageKey =
  'cv.application-registry.cover-letter-prompt.v1'

export const initialCoverLetterPrompt =
  'Write a concise, specific, professional cover letter.'

const coverLetterPromptRuntime = Atom.runtime(
  BrowserKeyValueStore.layerLocalStorage
)

export const coverLetterPromptAtom = Atom.kvs({
  defaultValue: () => initialCoverLetterPrompt,
  key: coverLetterPromptStorageKey,
  runtime: coverLetterPromptRuntime,
  schema: CoverLetterArtifactRequestSchema.fields.prompt,
})

/**
 * A null value means the editor follows the latest query result. A string is
 * the user's unsaved override and therefore must survive query refreshes.
 */
export const jobContextOverrideAtom = Atom.family((_applicationId: string) =>
  Atom.make<string | null>(null)
)

import * as Atom from 'effect/unstable/reactivity/Atom'

export const initialCoverLetterPrompt =
  'Write a direct, concise letter that explains why my verified experience is relevant. Avoid generic enthusiasm, clichés, and claims not present in the facts catalogue.'

/** Keeps per-application writing instructions stable across route navigation. */
export const coverLetterPromptAtom = Atom.family((_identity: string) =>
  Atom.make(initialCoverLetterPrompt)
)

/**
 * A null value means the editor follows the latest query result. A string is
 * the user's unsaved override and therefore must survive query refreshes.
 */
export const jobContextOverrideAtom = Atom.family((_applicationId: string) =>
  Atom.make<string | null>(null)
)

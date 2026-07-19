import * as Atom from 'effect/unstable/reactivity/Atom'

/**
 * Reactive projection of the external ChatGPT authentication hook.
 *
 * The login library remains the authority for authentication. This atom is
 * only the browser-session bridge consumed by preparation queries and actions.
 */
export const chatGptAuthenticatedAtom = Atom.make(false)

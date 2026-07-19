import { useAtom } from '@effect/atom-react'
import * as Atom from 'effect/unstable/reactivity/Atom'

import type { PreparationEditorIdentity } from './editor'

type PreparationCommandGate = {
  readonly executing: boolean
  readonly hasStarted: boolean
}

const commandGateFamily = Atom.family((identity: string) =>
  Atom.make<PreparationCommandGate>({
    executing: false,
    hasStarted: false,
  }).pipe(Atom.withLabel(`preparation/command-gate/${identity}`))
)

export const preparationCommandGateKey = (
  identity: PreparationEditorIdentity
): string =>
  JSON.stringify([identity.applicationId, identity.kind, identity.locale])

/**
 * Atomically claims one page command for an editor identity. The updater reads
 * the registry's current value, so a second invocation cannot rely on a stale
 * React render and replace the in-flight Effect function atom.
 */
export const usePreparationCommandGate = (
  identity: PreparationEditorIdentity
) => {
  const [state, setState] = useAtom(
    commandGateFamily(preparationCommandGateKey(identity))
  )

  const claim = (): boolean => {
    let claimed = false
    setState((current) => {
      if (current.executing) return current
      claimed = true
      return { executing: true, hasStarted: true }
    })
    return claimed
  }

  const release = () => {
    setState((current) => ({ ...current, executing: false }))
  }

  return { ...state, claim, release } as const
}

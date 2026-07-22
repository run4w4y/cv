import * as Atom from 'effect/unstable/reactivity/Atom'

/**
 * Creates an independent Effect function atom for every identity. A wrapper
 * around one shared result atom is not sufficient: overlapping executions can
 * otherwise wait on or replace the other identity's result channel.
 */
export const keyedCommandFamily = <Arg, A, E>(
  label: string,
  makeCommand: () => Atom.AtomResultFn<Arg, A, E>
) =>
  Atom.family((key: string) =>
    makeCommand().pipe(Atom.withLabel(`${label}/${key}`))
  )

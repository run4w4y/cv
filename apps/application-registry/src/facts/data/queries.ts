import {
  FactsReader,
  type LoadedActiveFactsRelease,
} from '@cv/facts-reader/reader'
import type * as AsyncResult from 'effect/unstable/reactivity/AsyncResult'
import * as Atom from 'effect/unstable/reactivity/Atom'

import { factsDataRuntime } from './runtime'

const withActiveReleaseCaching = <A, E>(
  atom: Atom.Atom<AsyncResult.AsyncResult<A, E>>
) =>
  atom.pipe(
    Atom.swr({
      revalidateOnFocus: false,
      revalidateOnMount: true,
      staleTime: '1 minute',
    }),
    Atom.setIdleTTL('5 minutes')
  )

/** Locale-independent metadata for the active verified facts release. */
export const activeFactsReleaseAtom = withActiveReleaseCaching(
  factsDataRuntime.atom(FactsReader.use((reader) => reader.readActiveRelease()))
)

const catalogueFamily = Atom.family((activeRelease: LoadedActiveFactsRelease) =>
  Atom.family((locale: string) =>
    factsDataRuntime
      .atom(
        FactsReader.use((reader) =>
          reader.readForActiveRelease(activeRelease, locale)
        )
      )
      .pipe(Atom.setIdleTTL('5 minutes'))
  )
)

/** Immutable catalogue data for one already-verified active release and locale. */
export const factsCatalogueAtom = (
  activeRelease: LoadedActiveFactsRelease,
  locale: string
) => catalogueFamily(activeRelease)(locale)

import { RegistryContext } from '@effect/atom-react'
import {
  type RenderOptions,
  type RenderResult,
  render,
} from '@testing-library/react'
import type * as Atom from 'effect/unstable/reactivity/Atom'
import * as AtomRegistry from 'effect/unstable/reactivity/AtomRegistry'
import type { ReactElement } from 'react'
import * as React from 'react'

export const TestRegistryProvider = ({
  children,
  initialValues,
}: {
  readonly children: React.ReactNode
  readonly initialValues?:
    | Iterable<readonly [Atom.Atom<unknown>, unknown]>
    | undefined
}) => {
  const [registry] = React.useState(() =>
    AtomRegistry.make({
      defaultIdleTTL: 0,
      initialValues,
      scheduleTask: (task) => {
        const timeout = setTimeout(task, 0)
        return () => clearTimeout(timeout)
      },
    })
  )
  return (
    <RegistryContext.Provider value={registry}>
      {children}
    </RegistryContext.Provider>
  )
}

type RegistryRenderOptions = Omit<RenderOptions, 'wrapper'> & {
  readonly initialValues?:
    | Iterable<readonly [Atom.Atom<unknown>, unknown]>
    | undefined
}

export const renderWithRegistry = (
  element: ReactElement,
  options?: RegistryRenderOptions
): RenderResult => {
  const { initialValues, ...renderOptions } = options ?? {}
  const Wrapper = ({ children }: { readonly children: React.ReactNode }) => (
    <TestRegistryProvider initialValues={initialValues}>
      {children}
    </TestRegistryProvider>
  )
  return render(element, { ...renderOptions, wrapper: Wrapper })
}

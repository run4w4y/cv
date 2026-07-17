import { RegistryContext } from '@effect/atom-react'
import {
  type RenderOptions,
  type RenderResult,
  render,
} from '@testing-library/react'
import * as AtomRegistry from 'effect/unstable/reactivity/AtomRegistry'
import type { ReactElement } from 'react'
import * as React from 'react'

export const TestRegistryProvider = ({
  children,
}: {
  readonly children: React.ReactNode
}) => {
  const [registry] = React.useState(() =>
    AtomRegistry.make({
      defaultIdleTTL: 0,
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

export const renderWithRegistry = (
  element: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>
): RenderResult =>
  render(element, { ...options, wrapper: TestRegistryProvider })

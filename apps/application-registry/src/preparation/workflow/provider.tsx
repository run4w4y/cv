import { useAtomMount } from '@effect/atom-react'
import type * as React from 'react'

import { preparationRuntime } from './atoms'

/**
 * Owns the desktop renderer's session-scoped Workflow engine.
 *
 * This provider must stay above RouterProvider: route transitions may replace
 * every workflow screen without unmounting or cancelling engine executions.
 */
export const PreparationWorkflowProvider = ({
  children,
}: {
  readonly children: React.ReactNode
}) => {
  useAtomMount(preparationRuntime)
  return children
}

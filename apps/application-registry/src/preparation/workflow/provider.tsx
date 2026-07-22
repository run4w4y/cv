import { useAtomMount } from '@effect/atom-react'
import type * as React from 'react'

import { preparationRuntime } from './atoms'

/** Owns the session-scoped in-memory Workflow engine for the browser app. */
export const PreparationWorkflowProvider = ({
  children,
}: {
  readonly children: React.ReactNode
}) => {
  useAtomMount(preparationRuntime)
  return children
}

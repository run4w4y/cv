import { useAtomMount } from '@effect/atom-react'
import type * as React from 'react'

import { cvPublicationRuntime } from './atoms'

/** Owns the browser-session Workflow engine and publication projection. */
export const CvPublicationWorkflowProvider = ({
  children,
}: {
  readonly children: React.ReactNode
}) => {
  useAtomMount(cvPublicationRuntime)
  return children
}

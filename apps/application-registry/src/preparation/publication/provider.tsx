import { useAtomMount } from '@effect/atom-react'
import type * as React from 'react'

import { cvPublicationRuntime } from './atoms'

/** Lazily mounts the browser-session publication engine from owning routes. */
export const CvPublicationWorkflowProvider = ({
  children,
}: {
  readonly children: React.ReactNode
}) => {
  useAtomMount(cvPublicationRuntime)
  return children
}

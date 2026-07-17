import * as React from 'react'
import { createPortal } from 'react-dom'

const HeaderActionsContext = React.createContext<HTMLDivElement | null>(null)

export const HeaderActionsProvider = ({
  target,
  children,
}: {
  readonly target: HTMLDivElement | null
  readonly children: React.ReactNode
}) => (
  <HeaderActionsContext.Provider value={target}>
    {children}
  </HeaderActionsContext.Provider>
)

export const HeaderActions = ({
  children,
}: {
  readonly children: React.ReactNode
}) => {
  const target = React.useContext(HeaderActionsContext)
  return target === null ? null : createPortal(children, target)
}

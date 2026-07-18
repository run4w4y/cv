import * as React from 'react'

export type TransientAiOperation = 'cv' | 'cover-letter'

export type TransientAiSessionState = {
  readonly generationCount: number
  readonly lastOperation: TransientAiOperation | null
  readonly modelId: string | null
}

export const initialTransientAiSessionState: TransientAiSessionState = {
  generationCount: 0,
  lastOperation: null,
  modelId: null,
}

export type TransientAiSessionAction =
  | { readonly type: 'select-model'; readonly modelId: string }
  | { readonly type: 'generated'; readonly operation: TransientAiOperation }
  | { readonly type: 'complete' }

export const reduceTransientAiSession = (
  state: TransientAiSessionState,
  action: TransientAiSessionAction
): TransientAiSessionState => {
  switch (action.type) {
    case 'select-model':
      return { ...state, modelId: action.modelId }
    case 'generated':
      return {
        ...state,
        generationCount: state.generationCount + 1,
        lastOperation: action.operation,
      }
    case 'complete':
      return initialTransientAiSessionState
  }
}

type TransientAiSessionValue = {
  readonly state: TransientAiSessionState
  readonly selectModel: (modelId: string) => void
  readonly markGenerated: (operation: TransientAiOperation) => void
  readonly complete: () => void
}

const TransientAiSessionContext =
  React.createContext<TransientAiSessionValue | null>(null)

export const TransientAiSessionProvider = ({
  children,
}: {
  readonly children: React.ReactNode
}) => {
  const [state, dispatch] = React.useReducer(
    reduceTransientAiSession,
    initialTransientAiSessionState
  )
  const value = React.useMemo<TransientAiSessionValue>(
    () => ({
      state,
      selectModel: (modelId) => dispatch({ type: 'select-model', modelId }),
      markGenerated: (operation) => dispatch({ type: 'generated', operation }),
      complete: () => dispatch({ type: 'complete' }),
    }),
    [state]
  )

  return (
    <TransientAiSessionContext.Provider value={value}>
      {children}
    </TransientAiSessionContext.Provider>
  )
}

export const useTransientAiSession = (): TransientAiSessionValue => {
  const value = React.useContext(TransientAiSessionContext)
  if (value === null) {
    throw new Error(
      'useTransientAiSession must be used within TransientAiSessionProvider.'
    )
  }
  return value
}

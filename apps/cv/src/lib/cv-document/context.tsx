import { createContext, type ReactNode, useContext } from 'react'
import type { CvContent } from '@/cv-content/model'
import type { CvPageContextValue } from '@/lib/private-content-session/page-context'
import type { CvSession } from '@/lib/private-content-session/session'

export type OpenCvFile = (href: string) => Promise<void>

export type CvDocumentContextValue = {
  content: CvContent
  openFile: OpenCvFile
  page: CvPageContextValue
  session: CvSession
}

type CvDocumentProviderProps = {
  children: ReactNode
  value: CvDocumentContextValue
}

const missingDocumentContext = () => {
  throw new Error('CV document context is not available')
}

const CvDocumentContext = createContext<CvDocumentContextValue | null>(null)

export const CvDocumentProvider = ({
  children,
  value,
}: CvDocumentProviderProps) => (
  <CvDocumentContext.Provider value={value}>
    {children}
  </CvDocumentContext.Provider>
)

export const useCvDocument = () => {
  const value = useContext(CvDocumentContext)

  return value ?? missingDocumentContext()
}

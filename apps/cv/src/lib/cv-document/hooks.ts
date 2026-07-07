import { useCvDocument } from '@/lib/cv-document/context'
import type { CvSession } from '@/lib/private-content-session/session'

export const useCvSession = (): CvSession => useCvDocument().session

export const useCvContent = () => useCvDocument().content

export const useCvPage = () => useCvDocument().page

export const useOpenCvFile = () => useCvDocument().openFile

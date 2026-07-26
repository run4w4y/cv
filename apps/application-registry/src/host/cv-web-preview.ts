import {
  type CvCapabilityLink,
  cvWebPreviewUrl,
} from '@cv/application-registry-api-contract'

import { defaultCvWebOrigin, normalizeCvWebOrigin } from './cv-web-origin'

interface CvWebEnvironment {
  readonly VITE_CV_WEB_ORIGIN?: string
}

interface CvWebPreviewOptions {
  readonly development?: boolean
  readonly environment?: CvWebEnvironment
}

const runtimeEnvironment = (): CvWebEnvironment => ({
  VITE_CV_WEB_ORIGIN: import.meta.env.VITE_CV_WEB_ORIGIN,
})

/**
 * Produces only preview URLs whose origin is the one trusted by the Registry
 * document policy. A stale or compromised persisted URL fails closed.
 */
export const registryCvWebPreviewUrl = (
  link: CvCapabilityLink,
  options: CvWebPreviewOptions = {}
): string => {
  const environment = options.environment ?? runtimeEnvironment()
  const development = options.development ?? import.meta.env.DEV
  const trustedOrigin = normalizeCvWebOrigin(
    environment.VITE_CV_WEB_ORIGIN?.trim() || defaultCvWebOrigin,
    development
  )
  const previewUrl = cvWebPreviewUrl(link)
  if (new URL(previewUrl).origin !== trustedOrigin) {
    throw new Error(
      'The staged CV preview URL does not match VITE_CV_WEB_ORIGIN.'
    )
  }
  return previewUrl
}

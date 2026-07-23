import 'server-only'

import { Config, Effect } from 'effect'

import { cvRenderContractVersion } from '@/document/version'

export const cvRenderVersion = () =>
  `${cvRenderContractVersion}:${Effect.runSync(
    Config.nonEmptyString('CV_DEPLOYMENT_ID').pipe(
      Config.withDefault('development')
    )
  )}`

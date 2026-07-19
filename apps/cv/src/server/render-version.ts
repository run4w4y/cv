import 'server-only'

import { getDeploymentId } from '@opennextjs/cloudflare'

import { cvRenderContractVersion } from '@/document/version'

export const cvRenderVersion = () =>
  `${cvRenderContractVersion}:${getDeploymentId()}`

import { fileURLToPath } from 'node:url'
import {
  type RegistryOutboundService,
  registryTestToken,
  RegistryWorkerHarness as SharedRegistryWorkerHarness,
} from '@cv/worker-test-kit/application-registry'

const workerBundlePath = fileURLToPath(
  new URL('../../dist/index.js', import.meta.url)
)

export type RegistryWorkerHarness = SharedRegistryWorkerHarness

export const RegistryWorkerHarness = {
  make: (
    token = registryTestToken,
    outboundService?: RegistryOutboundService
  ) =>
    SharedRegistryWorkerHarness.make({
      outboundService,
      token,
      workerBundlePath,
    }),
  makeWithOutboundService: (
    outboundService: RegistryOutboundService,
    token = registryTestToken
  ) =>
    SharedRegistryWorkerHarness.make({
      outboundService,
      token,
      workerBundlePath,
    }),
}

export { registryTestToken }

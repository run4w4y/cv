import * as BrowserCrypto from '@effect/platform-browser/BrowserCrypto'
import { Effect, Layer } from 'effect'
import * as Atom from 'effect/unstable/reactivity/Atom'
import * as WorkflowEngine from 'effect/unstable/workflow/WorkflowEngine'

import { preparationDataLayer } from '@/preparation/data/runtime'
import { CvPublicationProgress, cvPublicationProgressLayer } from '../progress'
import { cvPublicationWorkflowLayer } from '../workflow'

const cvPublicationServicesLayer = Layer.mergeAll(
  preparationDataLayer,
  cvPublicationProgressLayer,
  BrowserCrypto.layer
)

export const cvPublicationRuntimeLayer = cvPublicationWorkflowLayer.pipe(
  Layer.provideMerge(cvPublicationServicesLayer),
  Layer.provideMerge(WorkflowEngine.layerMemory)
)

/** Session-scoped in-memory publication Workflow runtime. Mount once at root. */
export const cvPublicationRuntime = Atom.runtime(
  cvPublicationRuntimeLayer
).pipe(Atom.keepAlive)

export const cvPublicationRunsAtom = cvPublicationRuntime
  .subscriptionRef(Effect.map(CvPublicationProgress, ({ runs }) => runs))
  .pipe(Atom.keepAlive)

import type { PreparationRun } from '@cv/application-preparation-workflow/domain'
import * as AsyncResult from 'effect/unstable/reactivity/AsyncResult'
import * as Atom from 'effect/unstable/reactivity/Atom'
import type { PreparationBootstrap } from '../data'
import { preparationBootstrapAtom } from '../data'
import type { PreparationEditorSession } from '../editor'
import {
  derivePreparationEditorSession,
  type PreparationEditorIdentity,
  preparationEditorLocalStateAtom,
} from '../editor'
import {
  applicationPreparationIdentity,
  latestApplicationRunAtom,
  latestOpenApplicationRunAtom,
  preparationRunAtom,
} from '../workflow/atoms'

export type PreparationWorkspaceIdentity = PreparationEditorIdentity & {
  readonly requestedRunId: string | null
}

export type PreparationWorkspace = {
  readonly bootstrap: PreparationBootstrap
  readonly editor: PreparationEditorSession
  readonly run: PreparationRun | null
}

const runBelongsToWorkspace = (
  run: PreparationRun | null,
  identity: PreparationWorkspaceIdentity
): run is PreparationRun =>
  run !== null &&
  run.applicationId === identity.applicationId &&
  run.kind === identity.kind &&
  run.locale === identity.locale

const selectedRunFamily = Atom.family(
  (identity: PreparationWorkspaceIdentity) => {
    const applicationIdentity = applicationPreparationIdentity(
      identity.applicationId,
      identity.kind,
      identity.locale
    )
    return Atom.make((get) => {
      const open = get(latestOpenApplicationRunAtom(applicationIdentity))
      const latest = get(latestApplicationRunAtom(applicationIdentity))
      const requested =
        identity.requestedRunId === null
          ? AsyncResult.success<PreparationRun | null>(null)
          : get(preparationRunAtom(identity.requestedRunId))
      return AsyncResult.map(
        AsyncResult.all({ latest, open, requested }),
        (runs) =>
          runs.open ??
          (runBelongsToWorkspace(runs.requested, identity)
            ? runs.requested
            : runs.latest)
      )
    })
  }
)

const workspaceFamily = Atom.family(
  (identity: PreparationWorkspaceIdentity) => {
    const editorIdentity: PreparationEditorIdentity = {
      applicationId: identity.applicationId,
      kind: identity.kind,
      locale: identity.locale,
    }
    return Atom.make((get) =>
      AsyncResult.map(
        AsyncResult.all({
          bootstrap: get(preparationBootstrapAtom(editorIdentity)),
          run: get(selectedRunFamily(identity)),
        }),
        ({ bootstrap, run }) =>
          ({
            bootstrap,
            editor: derivePreparationEditorSession({
              head: bootstrap.head,
              identity: editorIdentity,
              local: get(preparationEditorLocalStateAtom(editorIdentity)),
              run,
            }),
            run,
          }) satisfies PreparationWorkspace
      )
    )
  }
)

/**
 * One reactive preparation read model for a route. Components subscribe to
 * this projection instead of synchronizing query heads and Workflow candidates
 * through effects and loaded-key refs.
 */
export const preparationWorkspaceAtom = (
  identity: PreparationWorkspaceIdentity
) => workspaceFamily(identity)

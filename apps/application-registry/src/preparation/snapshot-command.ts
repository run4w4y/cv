import { preparationCommandGateKey } from './command-gate'
import { makeRefreshJobSnapshotAtom } from './data'
import type { PreparationEditorIdentity } from './editor'
import { keyedCommandFamily } from './keyed-command'

const refreshJobSnapshotFamily = keyedCommandFamily(
  'preparation/command/refresh-snapshot',
  makeRefreshJobSnapshotAtom
)

export const refreshJobSnapshotCommandAtom = (
  identity: PreparationEditorIdentity
) => refreshJobSnapshotFamily(preparationCommandGateKey(identity))

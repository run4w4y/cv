import { Effect } from 'effect'

import { type EnqueueRegistryCommand, RegistryOutbox } from './model'

export const enqueueRegistryCommand = (command: EnqueueRegistryCommand) =>
  RegistryOutbox.pipe(Effect.flatMap((outbox) => outbox.enqueue(command)))

export const listRegistryOutbox = RegistryOutbox.pipe(
  Effect.flatMap((outbox) => outbox.list())
)

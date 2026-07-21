import { Schema } from 'effect'

export class DesktopIpcRequestError extends Schema.TaggedErrorClass<DesktopIpcRequestError>()(
  'DesktopIpcRequestError',
  {
    cause: Schema.Defect(),
    message: Schema.String,
  }
) {}

export const desktopIpc = {
  codexCancel: 'cv-desktop:codex:cancel',
  codexGenerate: 'cv-desktop:codex:generate',
  codexStatus: 'cv-desktop:codex:status',
  networkFetch: 'cv-desktop:network:fetch',
  registryConfigure: 'cv-desktop:registry:configure',
  registryStatus: 'cv-desktop:registry:status',
} as const

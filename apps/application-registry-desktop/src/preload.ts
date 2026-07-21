import type {
  DesktopCodexGenerationRequest,
  DesktopFetchRequest,
  DesktopHostBridge,
} from '@cv/application-registry-desktop-contract'
import { contextBridge, ipcRenderer } from 'electron'

import { desktopIpc } from './ipc'

const bridge: DesktopHostBridge = {
  codex: {
    cancel: (operationId) =>
      ipcRenderer.invoke(desktopIpc.codexCancel, operationId),
    generate: (request: DesktopCodexGenerationRequest) =>
      ipcRenderer.invoke(desktopIpc.codexGenerate, request),
    status: () => ipcRenderer.invoke(desktopIpc.codexStatus),
  },
  network: {
    fetch: (request: DesktopFetchRequest) =>
      ipcRenderer.invoke(desktopIpc.networkFetch, request),
  },
  registry: {
    configure: (input) =>
      ipcRenderer.invoke(desktopIpc.registryConfigure, input),
    status: () => ipcRenderer.invoke(desktopIpc.registryStatus),
  },
}

contextBridge.exposeInMainWorld('cvDesktop', bridge)

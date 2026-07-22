import { join, relative, resolve, sep } from 'node:path'
import { pathToFileURL } from 'node:url'
import {
  type DesktopBridgeErrorCode,
  type DesktopBridgeResult,
  DesktopCodexGenerationRequestSchema,
  DesktopFetchRequestSchema,
  DesktopOperationIdSchema,
  DesktopRegistryConfigureSchema,
} from '@cv/application-registry-desktop-contract'
import * as NodeFileSystem from '@effect/platform-node/NodeFileSystem'
import * as NodeHttpClient from '@effect/platform-node/NodeHttpClient'
import * as NodePath from '@effect/platform-node/NodePath'
import { Effect, Layer, ManagedRuntime, Match, Schema } from 'effect'
import {
  app,
  BrowserWindow,
  dialog,
  type IpcMainInvokeEvent,
  ipcMain,
  net,
  protocol,
  safeStorage,
  session,
  shell,
} from 'electron'
import { desktopProduct } from '../desktop.config'
import type { CodexSdkError } from './codex/sdk'
import { DesktopCodex, desktopCodexLayer } from './codex/service'
import { DesktopDiagnostics, desktopDiagnosticsLayer } from './diagnostics'
import { DesktopIpcRequestError, desktopIpc } from './ipc'
import {
  DesktopNetwork,
  type DesktopNetworkError,
  desktopNetworkLayer,
} from './network'
import {
  DesktopRegistryConnection,
  type DesktopRegistryConnectionError,
  desktopRegistryConnectionLayer,
} from './registry-connection'
import {
  DesktopSettings,
  type DesktopSettingsError,
  desktopSettingsLayer,
  ElectronSafeStorage,
  ElectronSafeStorageError,
} from './settings'

protocol.registerSchemesAsPrivileged([
  {
    privileges: {
      allowServiceWorkers: false,
      bypassCSP: false,
      secure: true,
      standard: true,
      supportFetchAPI: true,
    },
    scheme: 'cv-registry',
  },
])
app.enableSandbox()

const success = <Value>(value: Value): DesktopBridgeResult<Value> => ({
  ok: true,
  value,
})

type DesktopExpectedError =
  | CodexSdkError
  | DesktopIpcRequestError
  | DesktopNetworkError
  | DesktopRegistryConnectionError
  | DesktopSettingsError

const bridgeFailure = (
  code: DesktopBridgeErrorCode,
  message: string,
  details: string | null = null
): DesktopBridgeResult<never> => ({
  error: { code, details, message },
  ok: false,
})

const publicFailure = (
  error: DesktopExpectedError,
  fallbackCode: DesktopBridgeErrorCode
): DesktopBridgeResult<never> =>
  Match.value(error).pipe(
    Match.tag('CodexSdkError', (failure) =>
      bridgeFailure(failure.code, failure.message, failure.details)
    ),
    Match.tag('DesktopNetworkError', (failure) =>
      bridgeFailure(failure.code, failure.message)
    ),
    Match.tag('DesktopRegistryConnectionError', (failure) =>
      bridgeFailure(failure.code, failure.message)
    ),
    Match.tag('DesktopSettingsError', (failure) =>
      bridgeFailure(
        failure.code === 'configuration_invalid'
          ? 'invalid_request'
          : fallbackCode,
        failure.message
      )
    ),
    Match.tag('DesktopIpcRequestError', (failure) =>
      bridgeFailure('invalid_request', failure.message)
    ),
    Match.exhaustive
  )

const unexpectedFailure = (
  fallbackCode: DesktopBridgeErrorCode
): DesktopBridgeResult<never> =>
  bridgeFailure(
    fallbackCode,
    'The desktop operation failed. See the desktop log for details.'
  )

const runtimeRoot = () =>
  app.isPackaged ? app.getAppPath() : join(app.getAppPath(), 'dist')

const packagedCodexExecutable = () =>
  app.isPackaged
    ? join(
        process.resourcesPath,
        'app.asar.unpacked',
        'node_modules',
        '@openai',
        'codex-win32-x64',
        'vendor',
        'x86_64-pc-windows-msvc',
        'bin',
        'codex.exe'
      )
    : undefined

let mainWindow: BrowserWindow | null = null

const validSender = (event: IpcMainInvokeEvent) =>
  mainWindow !== null &&
  event.sender === mainWindow.webContents &&
  event.senderFrame === event.sender.mainFrame &&
  event.senderFrame.url.startsWith('cv-registry://app/')

const safeExternalUrl = (raw: string): string | null => {
  try {
    const url = new URL(raw)
    return url.protocol === 'https:' && !url.username && !url.password
      ? url.href
      : null
  } catch {
    return null
  }
}

const rendererFile = (root: string, request: Request): string | null => {
  const url = new URL(request.url)
  if (url.hostname !== 'app') return null
  let pathname: string
  try {
    pathname = decodeURIComponent(url.pathname)
  } catch {
    return null
  }
  const requested = pathname === '/' ? '/index.html' : pathname
  const target = resolve(root, `.${requested}`)
  const fromRoot = relative(root, target)
  return fromRoot === '' ||
    (!fromRoot.startsWith(`..${sep}`) && fromRoot !== '..')
    ? target
    : null
}

const installRendererProtocol = () => {
  const root = join(runtimeRoot(), 'renderer')
  protocol.handle('cv-registry', (request) => {
    const target = rendererFile(root, request)
    return target === null
      ? new Response('Not found', { status: 404 })
      : net.fetch(pathToFileURL(target).href)
  })
}

const createDesktopLayer = () => {
  const platform = Layer.mergeAll(NodeFileSystem.layer, NodePath.layer)
  const encryption = Layer.succeed(
    ElectronSafeStorage,
    ElectronSafeStorage.of({
      decrypt: (encrypted) =>
        Effect.tryPromise({
          try: () =>
            safeStorage
              .decryptStringAsync(Buffer.from(encrypted))
              .then(({ result }) => result),
          catch: (cause) =>
            new ElectronSafeStorageError({ cause, operation: 'decrypt' }),
        }),
      encrypt: (plainText) =>
        Effect.tryPromise({
          try: () => safeStorage.encryptStringAsync(plainText),
          catch: (cause) =>
            new ElectronSafeStorageError({ cause, operation: 'encrypt' }),
        }),
      isAvailable: Effect.tryPromise({
        try: () => safeStorage.isAsyncEncryptionAvailable(),
        catch: (cause) =>
          new ElectronSafeStorageError({ cause, operation: 'is-available' }),
      }),
    })
  )
  const settings = desktopSettingsLayer({
    userDataPath: app.getPath('userData'),
  }).pipe(Layer.provide(Layer.merge(platform, encryption)))
  const network = desktopNetworkLayer.pipe(
    Layer.provide(Layer.merge(settings, NodeHttpClient.layerUndici))
  )
  const registryConnection = desktopRegistryConnectionLayer.pipe(
    Layer.provide(Layer.merge(settings, NodeHttpClient.layerUndici))
  )
  const codex = desktopCodexLayer({
    executable: packagedCodexExecutable(),
    temporaryPath: app.getPath('temp'),
  }).pipe(Layer.provide(NodeFileSystem.layer))
  const diagnostics = desktopDiagnosticsLayer(app.getPath('userData')).pipe(
    Layer.provide(platform)
  )
  return Layer.mergeAll(
    settings,
    network,
    registryConnection,
    codex,
    diagnostics
  )
}

type DesktopRuntime = ManagedRuntime.ManagedRuntime<
  | DesktopSettings
  | DesktopNetwork
  | DesktopRegistryConnection
  | DesktopCodex
  | DesktopDiagnostics,
  never
>

const run = <Value, Error extends DesktopExpectedError>(
  runtime: DesktopRuntime,
  fallbackCode: DesktopBridgeErrorCode,
  operation: Effect.Effect<
    Value,
    Error,
    DesktopSettings | DesktopNetwork | DesktopRegistryConnection | DesktopCodex
  >
): Promise<DesktopBridgeResult<Value>> =>
  runtime.runPromise(
    operation.pipe(
      Effect.matchEffect({
        onFailure: (error) =>
          Effect.flatMap(DesktopDiagnostics, (diagnostics) =>
            diagnostics
              .log('error', 'ipc-operation-failed', error)
              .pipe(Effect.as(publicFailure(error, fallbackCode)))
          ),
        onSuccess: (value) => Effect.succeed(success(value)),
      }),
      Effect.catchCause((cause) =>
        Effect.flatMap(DesktopDiagnostics, (diagnostics) =>
          diagnostics
            .log('error', 'ipc-operation-defect', cause)
            .pipe(Effect.as(unexpectedFailure(fallbackCode)))
        )
      )
    )
  )

const decode = <S extends Schema.Top>(schema: S, input: unknown) =>
  Schema.decodeUnknownEffect(schema)(input).pipe(
    Effect.mapError(
      (cause) =>
        new DesktopIpcRequestError({
          cause,
          message: 'The desktop request payload is invalid.',
        })
    )
  )

const installIpc = (runtime: DesktopRuntime) => {
  const invoke = <Value, Error extends DesktopExpectedError>(
    event: IpcMainInvokeEvent,
    fallbackCode: DesktopBridgeErrorCode,
    operation: Effect.Effect<
      Value,
      Error,
      | DesktopSettings
      | DesktopNetwork
      | DesktopRegistryConnection
      | DesktopCodex
    >
  ) =>
    validSender(event)
      ? run(runtime, fallbackCode, operation)
      : Promise.resolve(
          publicFailure(
            new DesktopIpcRequestError({
              cause: new Error('Rejected IPC sender.'),
              message: 'The desktop request sender is invalid.',
            }),
            'invalid_request'
          )
        )

  ipcMain.handle(desktopIpc.registryStatus, (event) =>
    invoke(
      event,
      'registry_not_configured',
      Effect.flatMap(DesktopSettings, (settings) => settings.status)
    )
  )
  ipcMain.handle(desktopIpc.registryConfigure, (event, input: unknown) =>
    invoke(
      event,
      'invalid_request',
      decode(DesktopRegistryConfigureSchema, input).pipe(
        Effect.flatMap((value) =>
          Effect.flatMap(DesktopRegistryConnection, (connection) =>
            connection.configure(value)
          )
        )
      )
    )
  )
  ipcMain.handle(desktopIpc.networkFetch, (event, input: unknown) =>
    invoke(
      event,
      'network_failed',
      decode(DesktopFetchRequestSchema, input).pipe(
        Effect.flatMap((request) =>
          Effect.flatMap(DesktopNetwork, (network) => network.fetch(request))
        )
      )
    )
  )
  ipcMain.handle(desktopIpc.codexGenerate, (event, input: unknown) =>
    invoke(
      event,
      'codex_generation_failed',
      decode(DesktopCodexGenerationRequestSchema, input).pipe(
        Effect.flatMap((request) =>
          Effect.flatMap(DesktopCodex, (codex) => codex.generate(request))
        )
      )
    )
  )
  ipcMain.handle(desktopIpc.codexCancel, (event, input: unknown) =>
    invoke(
      event,
      'codex_cancelled',
      decode(DesktopOperationIdSchema, input).pipe(
        Effect.flatMap((operationId) =>
          Effect.flatMap(DesktopCodex, (codex) => codex.cancel(operationId))
        )
      )
    )
  )
  ipcMain.handle(desktopIpc.codexStatus, (event) =>
    invoke(
      event,
      'codex_startup_failed',
      Effect.flatMap(DesktopCodex, (codex) => codex.status)
    )
  )
}

const loadRenderer = async (window: BrowserWindow) => {
  while (!window.isDestroyed()) {
    try {
      await window.loadURL('cv-registry://app/index.html')
      return
    } catch (error) {
      const choice = await dialog.showMessageBox(window, {
        buttons: ['Retry', 'Quit'],
        cancelId: 1,
        defaultId: 0,
        detail:
          error instanceof Error ? error.message : 'Unknown renderer error.',
        message: 'The CV Registry interface could not be loaded.',
        type: 'error',
      })
      if (choice.response !== 0) {
        app.quit()
        return
      }
    }
  }
}

const createWindow = () => {
  const window = new BrowserWindow({
    height: 900,
    minHeight: 700,
    minWidth: 1024,
    show: false,
    title: desktopProduct.name,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: join(runtimeRoot(), 'preload.cjs'),
      sandbox: true,
    },
    width: 1440,
  })
  mainWindow = window
  window.once('ready-to-show', () => window.show())
  window.on('closed', () => {
    if (mainWindow === window) mainWindow = null
  })
  window.webContents.setWindowOpenHandler(({ url }) => {
    const external = safeExternalUrl(url)
    if (external !== null) void shell.openExternal(external)
    return { action: 'deny' }
  })
  window.webContents.on('will-navigate', (event, url) => {
    if (url.startsWith('cv-registry://app/')) return
    event.preventDefault()
    const external = safeExternalUrl(url)
    if (external !== null) void shell.openExternal(external)
  })
  window.webContents.on('will-attach-webview', (event) =>
    event.preventDefault()
  )
  void loadRenderer(window)
  return window
}

const start = async () => {
  if (!app.requestSingleInstanceLock()) {
    app.quit()
    return
  }
  await app.whenReady()
  app.setAppUserModelId(desktopProduct.appId)
  installRendererProtocol()
  session.defaultSession.setPermissionCheckHandler(() => false)
  session.defaultSession.setPermissionRequestHandler(
    (_webContents, _permission, callback) => callback(false)
  )

  const runtime = ManagedRuntime.make(createDesktopLayer())
  installIpc(runtime)
  createWindow()
  app.on('second-instance', () => {
    if (mainWindow === null) return
    if (mainWindow.isMinimized()) mainWindow.restore()
    mainWindow.show()
    mainWindow.focus()
  })
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
  app.once('before-quit', () => {
    void runtime.dispose()
  })
}

void start().catch((error: unknown) => {
  dialog.showErrorBox(
    'CV Registry failed to start',
    error instanceof Error ? error.message : String(error)
  )
  app.quit()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

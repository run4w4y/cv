import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import * as NodeFileSystem from '@effect/platform-node/NodeFileSystem'
import { FuseV1Options, FuseVersion, flipFuses } from '@electron/fuses'
import { packager } from '@electron/packager'
import { Effect } from 'effect'
import { FileSystem } from 'effect/FileSystem'

import { desktopProduct } from '../desktop.config'

const projectRoot = dirname(
  fileURLToPath(new URL('../package.json', import.meta.url))
)
const distRoot = join(projectRoot, 'dist')
const releaseRoot = join(projectRoot, 'release')
const codexRelativePath = join(
  'node_modules',
  '@openai',
  'codex-win32-x64',
  'vendor',
  'x86_64-pc-windows-msvc',
  'bin',
  'codex.exe'
)

const installWindowsRuntime = (staging: string) =>
  Effect.tryPromise({
    try: async () => {
      const child = Bun.spawn(
        ['bun', 'install', '--production', '--os=win32', '--cpu=x64'],
        {
          cwd: staging,
          stderr: 'inherit',
          stdout: 'inherit',
        }
      )
      const exitCode = await child.exited
      if (exitCode !== 0)
        throw new Error(`bun install exited with ${exitCode}.`)
    },
    catch: (cause) =>
      new Error('Could not install the matching Windows Codex runtime.', {
        cause,
      }),
  })

const program = Effect.scoped(
  Effect.gen(function* () {
    const fs = yield* FileSystem
    if (!(yield* fs.exists(join(distRoot, 'main.mjs')))) {
      return yield* Effect.fail(
        new Error('Build the desktop application before packaging it.')
      )
    }
    const staging = yield* fs.makeTempDirectoryScoped({
      directory: projectRoot,
      prefix: '.package-',
    })
    yield* fs.copy(distRoot, staging, { overwrite: true })
    yield* installWindowsRuntime(staging)
    const codexExecutable = join(staging, codexRelativePath)
    if (!(yield* fs.exists(codexExecutable))) {
      return yield* Effect.fail(
        new Error(
          `The matching Codex ${desktopProduct.windowsPlatform}-${desktopProduct.windowsArchitecture} executable was not installed.`
        )
      )
    }

    yield* fs.remove(releaseRoot, { force: true, recursive: true })
    const outputs = yield* Effect.tryPromise({
      try: () =>
        packager({
          arch: desktopProduct.windowsArchitecture,
          asar: {
            unpackDir: join('node_modules', '@openai', 'codex-win32-x64', '**'),
          },
          dir: staging,
          executableName: desktopProduct.executableName,
          name: desktopProduct.executableName,
          out: releaseRoot,
          overwrite: true,
          platform: desktopProduct.windowsPlatform,
          prune: false,
          win32metadata: {
            CompanyName: 'add4',
            FileDescription: desktopProduct.name,
            ProductName: desktopProduct.name,
          },
        }),
      catch: (cause) => new Error('Electron packaging failed.', { cause }),
    })
    const output = outputs[0]
    if (output === undefined) {
      return yield* Effect.fail(
        new Error('Electron Packager returned no output.')
      )
    }
    const executable = join(output, `${desktopProduct.executableName}.exe`)
    yield* Effect.tryPromise({
      try: () =>
        flipFuses(executable, {
          [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
          [FuseV1Options.EnableNodeCliInspectArguments]: false,
          [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
          [FuseV1Options.GrantFileProtocolExtraPrivileges]: false,
          [FuseV1Options.OnlyLoadAppFromAsar]: true,
          [FuseV1Options.RunAsNode]: false,
          version: FuseVersion.V1,
        }),
      catch: (cause) =>
        new Error('Could not harden the Electron executable.', { cause }),
    })

    const packagedCodex = join(
      output,
      'resources',
      'app.asar.unpacked',
      codexRelativePath
    )
    if (!(yield* fs.exists(packagedCodex))) {
      return yield* Effect.fail(
        new Error(
          'The packaged Codex executable was not unpacked beside app.asar.'
        )
      )
    }
    console.info(`Packaged ${desktopProduct.name}: ${output}`)
  })
).pipe(Effect.provide(NodeFileSystem.layer))

Effect.runPromise(program).catch((error: unknown) => {
  console.error(error)
  process.exitCode = 1
})

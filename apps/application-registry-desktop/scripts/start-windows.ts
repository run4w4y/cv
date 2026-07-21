import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

import { desktopProduct } from '../desktop.config'

if (!process.env.WSL_INTEROP) {
  console.error('This target launches a native Windows build from WSL.')
  process.exit(1)
}

const executable = fileURLToPath(
  new URL(
    `../release/${desktopProduct.executableName}-win32-x64/${desktopProduct.executableName}.exe`,
    import.meta.url
  )
)
const distribution = dirname(executable)

const wslpath = Bun.spawn(['wslpath', '-w', distribution], {
  stderr: 'inherit',
  stdout: 'pipe',
})
const windowsDistribution = (await new Response(wslpath.stdout).text()).trim()
if ((await wslpath.exited) !== 0 || windowsDistribution.length === 0) {
  console.error(
    'Could not translate the packaged application path for Windows.'
  )
  process.exit(1)
}

const quote = (value: string) => `'${value.replaceAll("'", "''")}'`
const source = quote(windowsDistribution)
const processName = quote(desktopProduct.executableName)
const destinationName = quote(`${desktopProduct.executableName}-Development`)
const executableName = quote(`${desktopProduct.executableName}.exe`)
const script = [
  "$ErrorActionPreference = 'Stop'",
  `$running = Get-Process -Name ${processName} -ErrorAction SilentlyContinue | Select-Object -First 1`,
  `if ($null -ne $running) { throw ('Close the running ${desktopProduct.name} process (PID ' + $running.Id + ') before replacing the development build.') }`,
  `$destination = Join-Path $env:LOCALAPPDATA ${destinationName}`,
  'if (Test-Path -LiteralPath $destination) { Remove-Item -LiteralPath $destination -Recurse -Force }',
  `Copy-Item -LiteralPath ${source} -Destination $destination -Recurse -Force`,
  `$executable = Join-Path $destination ${executableName}`,
  '$process = Start-Process -FilePath $executable -WorkingDirectory $destination -PassThru',
  `Write-Output ('Started ${desktopProduct.name} from ' + $executable + ' with PID ' + $process.Id)`,
].join('; ')

const launcher = Bun.spawn(
  ['powershell.exe', '-NoProfile', '-NonInteractive', '-Command', script],
  { stderr: 'inherit', stdout: 'inherit' }
)

process.exit(await launcher.exited)

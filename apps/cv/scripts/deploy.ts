import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const configPath = process.argv[2]?.trim() || 'wrangler.deploy.jsonc'
const resolvedConfigPath = resolve(configPath)
const secret = process.env.CV_REVALIDATION_SECRET?.trim()
if (!secret) throw new Error('CV_REVALIDATION_SECRET must not be empty.')

const appRoot = fileURLToPath(new URL('../', import.meta.url))

const openNextCli = fileURLToPath(
  new URL(
    '../node_modules/@opennextjs/cloudflare/dist/cli/index.js',
    import.meta.url
  )
)
const wranglerCli = fileURLToPath(
  new URL('../../../node_modules/wrangler/bin/wrangler.js', import.meta.url)
)

const run = async (command: readonly string[]) => {
  const process = Bun.spawn(command, {
    cwd: appRoot,
    stderr: 'inherit',
    stdout: 'inherit',
  })
  const exitCode = await process.exited
  if (exitCode !== 0) {
    throw new Error(`${command[1] ?? command[0]} exited with code ${exitCode}.`)
  }
}

await run(['node', openNextCli, 'deploy', '--config', resolvedConfigPath])

const directory = await mkdtemp(join(tmpdir(), 'cv-public-deploy-'))
try {
  const secretsPath = join(directory, 'cv-public.secrets.json')
  await writeFile(
    secretsPath,
    `${JSON.stringify({ CV_REVALIDATION_SECRET: secret })}\n`,
    { mode: 0o600 }
  )
  await run([
    'node',
    wranglerCli,
    'secret',
    'bulk',
    secretsPath,
    '--config',
    resolvedConfigPath,
  ])
} finally {
  await rm(directory, { force: true, recursive: true })
}

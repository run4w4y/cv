import { generateCommand } from './command'
import { runCli } from './runtime'

runCli(generateCommand, {
  version: '0.1.0',
})

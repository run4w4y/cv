import { prepareCommand } from './command'
import { runCli } from './runtime'

runCli(prepareCommand, {
  version: '0.1.0',
})

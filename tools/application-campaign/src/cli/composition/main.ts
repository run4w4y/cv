import { prepareCommand } from '../command'
import { runCli } from '../runtime'
import { ApplicationCampaignCliLayer } from './runtime'

runCli(prepareCommand, { version: '0.1.0' }, ApplicationCampaignCliLayer)

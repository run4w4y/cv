#!/usr/bin/env bun

import { applicationRegistryCommand } from './command'
import { runApplicationRegistryCli } from './runtime'

runApplicationRegistryCli(applicationRegistryCommand, {
  version: '0.1.0',
})

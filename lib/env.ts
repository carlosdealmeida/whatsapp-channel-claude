/**
 * Loads .env from ~/.claude/channels/<name>/.env into process.env.
 * Real env wins — existing environment variables are not overwritten.
 */

import { readFileSync, chmodSync } from 'fs'
import { join } from 'path'
import { homedir } from 'os'

export function loadChannelEnv(channelName: string): void {
  const envFile = join(homedir(), '.claude', 'channels', channelName, '.env')
  try {
    try { chmodSync(envFile, 0o600) } catch {}
    for (const line of readFileSync(envFile, 'utf8').split('\n')) {
      const m = line.match(/^(\w+)=(.*)$/)
      if (m && process.env[m[1]] === undefined) {
        process.env[m[1]] = m[2]
      }
    }
  } catch {}
}

export function requireEnv(name: string, channelName: string): string {
  const val = process.env[name]
  if (!val) {
    const envFile = join(homedir(), '.claude', 'channels', channelName, '.env')
    process.stderr.write(
      `${channelName} channel: ${name} required\n` +
      `  set in ${envFile}\n` +
      `  format: ${name}=your_value_here\n`,
    )
    process.exit(1)
  }
  return val
}

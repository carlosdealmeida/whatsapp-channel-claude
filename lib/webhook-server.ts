/**
 * Embedded HTTP server for "webhook" provider mode.
 * Receives webhooks directly from Evolution API and serves a polling endpoint.
 * Uses Bun.serve() — zero external dependencies.
 */

import { extractMessage } from './evolution.ts'
import { isClaudeChannelMessage, stripClaudePrefix } from './message-filter.ts'
import type { QueuedMessage } from './types.ts'

const MESSAGE_TTL_MS = 60 * 60 * 1000 // 1 hour

const queues = new Map<string, QueuedMessage[]>()

function getQueue(project: string): QueuedMessage[] {
  if (!queues.has(project)) queues.set(project, [])
  return queues.get(project)!
}

function drainQueue(project: string): QueuedMessage[] {
  const cutoff = Date.now() - MESSAGE_TTL_MS
  const messages: QueuedMessage[] = []

  // Drain project queue
  const projectQueue = queues.get(project)
  if (projectQueue) {
    while (projectQueue.length > 0) {
      const msg = projectQueue.shift()!
      if ((msg.timestamp ?? 0) > cutoff) messages.push(msg)
    }
  }

  // Also drain default queue if requesting a specific project
  if (project !== 'default') {
    const defaultQueue = queues.get('default')
    if (defaultQueue) {
      while (defaultQueue.length > 0) {
        const msg = defaultQueue.shift()!
        if ((msg.timestamp ?? 0) > cutoff) messages.push(msg)
      }
    }
  }

  return messages
}

function handleWebhook(payload: Record<string, unknown>): { status: string } {
  const event = String(payload.event ?? '')
  if (event !== 'messages.upsert') return { status: 'ignored' }

  const extracted = extractMessage(payload)
  if (!extracted) return { status: 'ignored' }

  if (!isClaudeChannelMessage(extracted)) return { status: 'filtered' }

  const { content, project } = stripClaudePrefix(extracted.content)

  const queued: QueuedMessage = {
    sender: extracted.sender,
    message_id: extracted.messageId,
    type: extracted.type,
    content,
    raw: extracted.raw,
    timestamp: Date.now(),
  }

  getQueue(project).push(queued)
  return { status: 'queued' }
}

export function startWebhookServer(port: number): { url: string; stop: () => void } {
  const server = Bun.serve({
    port,
    async fetch(req) {
      const url = new URL(req.url)

      // POST /webhook/whatsapp — receive from Evolution API
      if (req.method === 'POST' && url.pathname === '/webhook/whatsapp') {
        try {
          const payload = (await req.json()) as Record<string, unknown>
          const result = handleWebhook(payload)
          return Response.json(result)
        } catch {
          return Response.json({ status: 'error', message: 'invalid payload' }, { status: 400 })
        }
      }

      // GET /pending — polling endpoint
      if (req.method === 'GET' && url.pathname === '/pending') {
        const project = url.searchParams.get('project') ?? 'default'
        const messages = drainQueue(project)
        return Response.json({ messages })
      }

      return Response.json({ error: 'not found' }, { status: 404 })
    },
  })

  const baseUrl = `http://localhost:${server.port}`
  process.stderr.write(`webhook-server: listening on ${baseUrl}\n`)

  return {
    url: baseUrl,
    stop: () => server.stop(),
  }
}

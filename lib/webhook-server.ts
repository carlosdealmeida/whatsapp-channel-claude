/**
 * Embedded HTTP server for "webhook" provider mode.
 * Receives webhooks directly from Evolution API and serves a polling endpoint.
 * Uses Bun.serve() — zero external dependencies.
 *
 * Security:
 * - Binds to 127.0.0.1 by default. Set WHATSAPP_WEBHOOK_HOST to expose it.
 * - When a secret is configured, every request must carry it, either in the
 *   `x-webhook-token` header or in the `token` query parameter (for webhook
 *   senders that cannot set headers). Comparison is constant-time.
 * - Binding to a non-loopback address without a secret is refused: anyone who
 *   could reach the port would be able to forge messages from an allowlisted
 *   number and approve tool permissions.
 */

import { timingSafeEqual } from 'crypto'
import { extractMessage } from './evolution.ts'
import { isClaudeChannelMessage, stripClaudePrefix } from './message-filter.ts'
import type { QueuedMessage } from './types.ts'

const MESSAGE_TTL_MS = 60 * 60 * 1000 // 1 hour
/** A project counts as active while it has polled within this window. */
const PROJECT_ACTIVE_MS = 30 * 1000
export const DEFAULT_PROJECT = 'default'
export const TOKEN_HEADER = 'x-webhook-token'

export type WebhookServerOptions = {
  port: number
  hostname?: string
  secret?: string
  /** Injected clock, for tests. */
  now?: () => number
}

export function isLoopback(hostname: string): boolean {
  const h = hostname.toLowerCase()
  return h === 'localhost' || h === '::1' || h === '[::1]' || /^127\./.test(h)
}

export function tokenMatches(expected: string, provided: string | null): boolean {
  if (!provided) return false
  const a = Buffer.from(expected)
  const b = Buffer.from(provided)
  return a.length === b.length && timingSafeEqual(a, b)
}

/**
 * In-memory queues, one per project. Exported separately from the HTTP layer
 * so routing can be tested without a socket.
 */
export class MessageQueues {
  private readonly queues = new Map<string, QueuedMessage[]>()
  private readonly lastPoll = new Map<string, number>()

  constructor(private readonly now: () => number = Date.now) {}

  /** Projects (other than default) that polled recently. Used to route `/claude <project> ...`. */
  activeProjects(): Set<string> {
    const cutoff = this.now() - PROJECT_ACTIVE_MS
    const active = new Set<string>()
    for (const [p, t] of this.lastPoll) if (p !== DEFAULT_PROJECT && t > cutoff) active.add(p)
    return active
  }

  private defaultIsActive(): boolean {
    return (this.lastPoll.get(DEFAULT_PROJECT) ?? 0) > this.now() - PROJECT_ACTIVE_MS
  }

  push(project: string, msg: QueuedMessage): void {
    if (!this.queues.has(project)) this.queues.set(project, [])
    this.queues.get(project)!.push(msg)
  }

  /**
   * Drains the project's queue. A named project also drains the default queue,
   * but only while no session is polling as "default" — otherwise two sessions
   * would race for the same messages.
   */
  drain(project: string): QueuedMessage[] {
    this.lastPoll.set(project, this.now())
    const out = this.take(project)
    if (project !== DEFAULT_PROJECT && !this.defaultIsActive()) out.push(...this.take(DEFAULT_PROJECT))
    return out
  }

  private take(project: string): QueuedMessage[] {
    const q = this.queues.get(project)
    if (!q) return []
    const cutoff = this.now() - MESSAGE_TTL_MS
    const live = q.filter(m => (m.timestamp ?? 0) > cutoff)
    q.length = 0
    return live
  }

  handleWebhook(payload: Record<string, unknown>): { status: string } {
    const event = String(payload.event ?? '')
    if (event !== 'messages.upsert') return { status: 'ignored' }

    const extracted = extractMessage(payload)
    if (!extracted) return { status: 'ignored' }

    if (!isClaudeChannelMessage(extracted)) return { status: 'filtered' }

    const { content, project } = stripClaudePrefix(extracted.content, this.activeProjects())

    this.push(project, {
      sender: extracted.sender,
      message_id: extracted.messageId,
      type: extracted.type,
      content,
      raw: extracted.raw,
      timestamp: this.now(),
    })
    return { status: 'queued' }
  }
}

export function startWebhookServer(opts: WebhookServerOptions): { url: string; stop: () => void } {
  const hostname = opts.hostname || '127.0.0.1'
  const secret = opts.secret || ''

  if (!secret && !isLoopback(hostname)) {
    throw new Error(
      `refusing to listen on ${hostname} without WHATSAPP_WEBHOOK_SECRET — ` +
        'anyone reaching the port could impersonate an allowlisted number. ' +
        'Set a secret, or keep WHATSAPP_WEBHOOK_HOST=127.0.0.1 behind a reverse proxy.',
    )
  }
  if (!secret) {
    process.stderr.write(
      'webhook-server: no WHATSAPP_WEBHOOK_SECRET set — any local process can post messages. Setting one is recommended.\n',
    )
  }

  const queues = new MessageQueues(opts.now)

  const server = Bun.serve({
    port: opts.port,
    hostname,
    async fetch(req) {
      const url = new URL(req.url)

      if (secret) {
        const provided = req.headers.get(TOKEN_HEADER) ?? url.searchParams.get('token')
        if (!tokenMatches(secret, provided)) {
          return Response.json({ error: 'unauthorized' }, { status: 401 })
        }
      }

      // POST /webhook/whatsapp — receive from Evolution API
      if (req.method === 'POST' && url.pathname === '/webhook/whatsapp') {
        try {
          const payload = (await req.json()) as Record<string, unknown>
          return Response.json(queues.handleWebhook(payload))
        } catch {
          return Response.json({ status: 'error', message: 'invalid payload' }, { status: 400 })
        }
      }

      // GET /pending — polling endpoint
      if (req.method === 'GET' && url.pathname === '/pending') {
        const project = (url.searchParams.get('project') || DEFAULT_PROJECT).toLowerCase()
        return Response.json({ messages: queues.drain(project) })
      }

      return Response.json({ error: 'not found' }, { status: 404 })
    },
  })

  const host = hostname.includes(':') && !hostname.startsWith('[') ? `[${hostname}]` : hostname
  const reachable = host === '0.0.0.0' || host === '[::]' ? '127.0.0.1' : host
  const baseUrl = `http://${reachable}:${server.port}`
  process.stderr.write(`webhook-server: listening on http://${host}:${server.port}\n`)

  return { url: baseUrl, stop: () => server.stop(true) }
}

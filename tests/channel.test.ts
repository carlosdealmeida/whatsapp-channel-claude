import { describe, expect, test, afterEach } from 'bun:test'
import { isClaudeChannelMessage, stripClaudePrefix, PERMISSION_REPLY_RE } from '../lib/message-filter.ts'
import { extractMessage, senderFromKey } from '../lib/evolution.ts'
import { MessageQueues, startWebhookServer, tokenMatches, isLoopback, TOKEN_HEADER } from '../lib/webhook-server.ts'
import type { ExtractedMessage } from '../lib/types.ts'

const PHONE = '5521999999999'

function upsert(message: Record<string, unknown>, key: Record<string, unknown> = {}) {
  return {
    event: 'messages.upsert',
    data: { key: { remoteJid: `${PHONE}@s.whatsapp.net`, id: 'MSG1', fromMe: false, ...key }, message },
  }
}

function extracted(type: ExtractedMessage['type'], content: string, raw: Record<string, unknown> = {}): ExtractedMessage {
  return { sender: PHONE, messageId: 'MSG1', type, content, raw }
}

describe('message filter', () => {
  test('accepts /claude text, case-insensitive', () => {
    expect(isClaudeChannelMessage(extracted('text', '/claude oi'))).toBe(true)
    expect(isClaudeChannelMessage(extracted('text', '  /CLAUDE oi'))).toBe(true)
  })

  test('rejects ordinary text and look-alike prefixes', () => {
    expect(isClaudeChannelMessage(extracted('text', 'oi'))).toBe(false)
    expect(isClaudeChannelMessage(extracted('text', '/claudex oi'))).toBe(false)
  })

  test('permission replies pass and expose answer and id', () => {
    expect(isClaudeChannelMessage(extracted('text', 'yes abcde'))).toBe(true)
    const m = PERMISSION_REPLY_RE.exec('sim QWERT')!
    expect(m[1]).toBe('sim')
    expect(m[2]).toBe('QWERT')
    expect(PERMISSION_REPLY_RE.test('yes abcdl')).toBe(false) // 'l' is excluded from IDs
  })

  test('media replying to a message passes; forwarded media does not', () => {
    const quoted = { message: { audioMessage: { contextInfo: { quotedMessage: { conversation: 'x' } } } } }
    const forwarded = { message: { audioMessage: { contextInfo: { isForwarded: true, forwardingScore: 1 } } } }
    const forwardedQuote = { message: { imageMessage: { contextInfo: { quotedMessage: {}, isForwarded: true } } } }
    expect(isClaudeChannelMessage(extracted('audio', '[audio]', quoted))).toBe(true)
    expect(isClaudeChannelMessage(extracted('audio', '[audio]', forwarded))).toBe(false)
    expect(isClaudeChannelMessage(extracted('image', '[image]', forwardedQuote))).toBe(false)
  })

  test('image with /claude caption passes', () => {
    expect(isClaudeChannelMessage(extracted('image', '/claude o que é isso?', { message: { imageMessage: {} } }))).toBe(true)
  })

  test('strips prefix and routes to a registered project', () => {
    expect(stripClaudePrefix('/claude api roda os testes', new Set(['api']))).toEqual({ content: 'roda os testes', project: 'api' })
    expect(stripClaudePrefix('/claude roda os testes', new Set(['api']))).toEqual({ content: 'roda os testes', project: 'default' })
    expect(stripClaudePrefix('/claude', new Set())).toEqual({ content: '(empty message)', project: 'default' })
  })
})

describe('sender resolution', () => {
  test('phone JID', () => {
    expect(senderFromKey({ remoteJid: `${PHONE}@s.whatsapp.net` })).toBe(PHONE)
    expect(senderFromKey({ remoteJid: `${PHONE}:12@s.whatsapp.net` })).toBe(PHONE)
  })

  test('LID uses the phone Evolution provides, else the LID', () => {
    expect(senderFromKey({ remoteJid: '123456789@lid', senderPn: `${PHONE}@s.whatsapp.net` })).toBe(PHONE)
    expect(senderFromKey({ remoteJid: '123456789@lid', remoteJidAlt: `${PHONE}@s.whatsapp.net` })).toBe(PHONE)
    expect(senderFromKey({ remoteJid: '123456789@lid' })).toBe('123456789')
  })

  test('groups, broadcasts and empty JIDs are dropped', () => {
    expect(senderFromKey({ remoteJid: '1203630@g.us' })).toBeNull()
    expect(senderFromKey({ remoteJid: 'status@broadcast' })).toBeNull()
    expect(senderFromKey({})).toBeNull()
  })

  test('extractMessage ignores own messages and groups', () => {
    expect(extractMessage(upsert({ conversation: '/claude oi' }, { fromMe: true }))).toBeNull()
    expect(extractMessage(upsert({ conversation: '/claude oi' }, { remoteJid: '1203630@g.us' }))).toBeNull()
    expect(extractMessage(upsert({ conversation: '/claude oi' }))?.sender).toBe(PHONE)
  })
})

describe('queues and routing', () => {
  function clock(start = 1_000_000) {
    let t = start
    return { now: () => t, advance: (ms: number) => (t += ms) }
  }

  test('message for an active project goes only to that project', () => {
    const c = clock()
    const q = new MessageQueues(c.now)
    q.drain('api') // api polls → becomes active
    q.drain('default')
    expect(q.handleWebhook(upsert({ conversation: '/claude api build' })).status).toBe('queued')
    expect(q.drain('default')).toHaveLength(0)
    const got = q.drain('api')
    expect(got).toHaveLength(1)
    expect(got[0]!.content).toBe('build')
  })

  test('named project picks up default messages only while no default session polls', () => {
    const c = clock()
    const q = new MessageQueues(c.now)
    q.handleWebhook(upsert({ conversation: '/claude oi' }))
    expect(q.drain('api')).toHaveLength(1) // nobody is "default": api takes it

    q.drain('default') // a default session appears
    q.handleWebhook(upsert({ conversation: '/claude oi de novo' }))
    expect(q.drain('api')).toHaveLength(0)
    expect(q.drain('default')).toHaveLength(1)

    c.advance(60_000) // default session went quiet
    q.handleWebhook(upsert({ conversation: '/claude ainda aí?' }))
    expect(q.drain('api')).toHaveLength(1)
  })

  test('expired messages are dropped', () => {
    const c = clock()
    const q = new MessageQueues(c.now)
    q.handleWebhook(upsert({ conversation: '/claude oi' }))
    c.advance(2 * 60 * 60 * 1000)
    expect(q.drain('default')).toHaveLength(0)
  })

  test('non-upsert events and filtered messages are not queued', () => {
    const q = new MessageQueues()
    expect(q.handleWebhook({ event: 'connection.update' }).status).toBe('ignored')
    expect(q.handleWebhook(upsert({ conversation: 'oi' })).status).toBe('filtered')
  })
})

describe('webhook server security', () => {
  let stop: (() => void) | undefined
  afterEach(() => { stop?.(); stop = undefined })

  test('helpers', () => {
    expect(isLoopback('127.0.0.1')).toBe(true)
    expect(isLoopback('localhost')).toBe(true)
    expect(isLoopback('::1')).toBe(true)
    expect(isLoopback('0.0.0.0')).toBe(false)
    expect(tokenMatches('s3cret', 's3cret')).toBe(true)
    expect(tokenMatches('s3cret', 's3creT')).toBe(false)
    expect(tokenMatches('s3cret', 's3cret-longer')).toBe(false)
    expect(tokenMatches('s3cret', null)).toBe(false)
  })

  test('refuses to bind a public address without a secret', () => {
    expect(() => startWebhookServer({ port: 0, hostname: '0.0.0.0' })).toThrow(/WHATSAPP_WEBHOOK_SECRET/)
  })

  test('defaults to loopback', () => {
    const srv = startWebhookServer({ port: 0 })
    stop = srv.stop
    expect(srv.url).toStartWith('http://127.0.0.1:')
  })

  test('requests without the secret are rejected; header or query token is accepted', async () => {
    const srv = startWebhookServer({ port: 0, secret: 's3cret' })
    stop = srv.stop
    const body = JSON.stringify(upsert({ conversation: '/claude oi' }))
    const post = (path: string, headers: Record<string, string> = {}) =>
      fetch(srv.url + path, { method: 'POST', body, headers: { 'Content-Type': 'application/json', ...headers } })

    expect((await post('/webhook/whatsapp')).status).toBe(401)
    expect((await post('/webhook/whatsapp?token=wrong')).status).toBe(401)
    expect((await fetch(srv.url + '/pending')).status).toBe(401)

    expect((await post('/webhook/whatsapp?token=s3cret')).status).toBe(200)
    expect((await post('/webhook/whatsapp', { [TOKEN_HEADER]: 's3cret' })).status).toBe(200)

    const res = await fetch(srv.url + '/pending', { headers: { [TOKEN_HEADER]: 's3cret' } })
    expect(res.status).toBe(200)
    const { messages } = (await res.json()) as { messages: unknown[] }
    expect(messages).toHaveLength(2)
  })
})

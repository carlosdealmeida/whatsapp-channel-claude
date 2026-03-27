/**
 * Evolution API client — send messages and download media.
 */

import type { EvolutionConfig, ExtractedMessage } from './types.ts'

function headers(apiKey: string): Record<string, string> {
  return { apikey: apiKey, 'Content-Type': 'application/json' }
}

function url(config: EvolutionConfig, endpoint: string): string {
  return `${config.apiUrl.replace(/\/+$/, '')}/${endpoint}/${config.instance}`
}

async function post(config: EvolutionConfig, endpoint: string, payload: unknown): Promise<unknown> {
  const res = await fetch(url(config, endpoint), {
    method: 'POST',
    headers: headers(config.apiKey),
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(30_000),
  })
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Evolution API ${endpoint} error ${res.status}: ${body}`)
  }
  return res.json()
}

export async function sendText(config: EvolutionConfig, to: string, text: string): Promise<unknown> {
  return post(config, 'message/sendText', { number: to, text })
}

export async function sendReply(
  config: EvolutionConfig,
  to: string,
  text: string,
  quotedMessageId: string,
): Promise<unknown> {
  return post(config, 'message/sendText', {
    number: to,
    text,
    quoted: { key: { id: quotedMessageId } },
  })
}

export async function sendAudio(
  config: EvolutionConfig,
  to: string,
  audioBase64: string,
): Promise<unknown> {
  return post(config, 'message/sendWhatsAppAudio', { number: to, audio: audioBase64 })
}

export async function downloadMedia(
  config: EvolutionConfig,
  messageId: string,
): Promise<Buffer | null> {
  try {
    const data = (await post(config, 'chat/getBase64FromMediaMessage', {
      message: { key: { id: messageId } },
    })) as { base64?: string }

    if (data.base64) {
      return Buffer.from(data.base64, 'base64')
    }
    return null
  } catch (err) {
    process.stderr.write(`evolution: download_media error: ${err}\n`)
    return null
  }
}

export function extractMessage(payload: Record<string, unknown>): ExtractedMessage | null {
  const data = (payload.data ?? {}) as Record<string, unknown>
  const key = (data.key ?? {}) as Record<string, unknown>
  const message = (data.message ?? {}) as Record<string, unknown>

  // Ignore messages sent by the bot itself
  if (key.fromMe) return null

  const sender = String(key.remoteJid ?? '').replace('@s.whatsapp.net', '')
  const messageId = String(key.id ?? '')

  if (!sender) return null

  let type: ExtractedMessage['type'] = 'text'
  let content = ''

  if ('conversation' in message) {
    content = String(message.conversation)
  } else if ('extendedTextMessage' in message) {
    const ext = message.extendedTextMessage as Record<string, unknown>
    content = String(ext.text ?? '')
  } else if ('audioMessage' in message) {
    type = 'audio'
    content = '[audio]'
  } else if ('imageMessage' in message) {
    type = 'image'
    const img = message.imageMessage as Record<string, unknown>
    content = String(img.caption ?? '[image]')
  } else if ('documentMessage' in message) {
    type = 'document'
    const doc = message.documentMessage as Record<string, unknown>
    content = String(doc.fileName ?? '[document]')
  }

  return { sender, messageId, type, content, raw: data as Record<string, unknown> }
}

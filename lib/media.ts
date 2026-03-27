/**
 * Media handling: audio transcription (Groq Whisper) and file utilities.
 */

import { writeFileSync, mkdirSync } from 'fs'
import { join, extname } from 'path'
import { homedir } from 'os'

export async function transcribeAudio(
  audioBytes: Buffer,
  groqApiKey: string,
  filename: string = 'audio.ogg',
): Promise<{ text: string; duration: number }> {
  const language = process.env.GROQ_LANGUAGE ?? 'en'
  const blob = new Blob([audioBytes], { type: mimeFromExt(extname(filename)) })
  const form = new FormData()
  form.append('file', blob, filename)
  form.append('model', 'whisper-large-v3-turbo')
  form.append('language', language)
  form.append('response_format', 'verbose_json')

  const res = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${groqApiKey}` },
    body: form,
  })

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Groq Whisper error ${res.status}: ${body}`)
  }

  const data = (await res.json()) as { text: string; duration?: number }
  return { text: data.text, duration: data.duration ?? 0 }
}

export async function downloadUrl(url: string): Promise<{ bytes: Buffer; contentType: string }> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 30_000)

  try {
    const res = await fetch(url, { signal: controller.signal })
    if (!res.ok) throw new Error(`download failed: HTTP ${res.status}`)
    const bytes = Buffer.from(await res.arrayBuffer())
    const contentType = res.headers.get('content-type') ?? 'application/octet-stream'
    return { bytes, contentType }
  } finally {
    clearTimeout(timeout)
  }
}

export function saveToInbox(
  channelName: string,
  bytes: Buffer,
  ext: string,
): string {
  const inboxDir = join(homedir(), '.claude', 'channels', channelName, 'inbox')
  mkdirSync(inboxDir, { recursive: true })
  const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`
  const path = join(inboxDir, filename)
  writeFileSync(path, bytes)
  return path
}

export function mimeFromExt(ext: string): string {
  const map: Record<string, string> = {
    '.ogg': 'audio/ogg',
    '.oga': 'audio/ogg',
    '.opus': 'audio/opus',
    '.mp3': 'audio/mpeg',
    '.m4a': 'audio/mp4',
    '.wav': 'audio/wav',
    '.webm': 'audio/webm',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.pdf': 'application/pdf',
  }
  return map[ext.toLowerCase()] ?? 'application/octet-stream'
}

export function extFromMime(mime: string): string {
  const map: Record<string, string> = {
    'audio/ogg': '.ogg',
    'audio/opus': '.opus',
    'audio/mpeg': '.mp3',
    'audio/mp4': '.m4a',
    'audio/wav': '.wav',
    'audio/webm': '.webm',
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/gif': '.gif',
    'image/webp': '.webp',
    'application/pdf': '.pdf',
  }
  return map[mime.split(';')[0].trim().toLowerCase()] ?? '.bin'
}

/**
 * Shared types for the WhatsApp channel.
 */

export type EvolutionConfig = {
  apiUrl: string
  instance: string
  apiKey: string
}

export type ExtractedMessage = {
  sender: string
  messageId: string
  type: 'text' | 'audio' | 'image' | 'document'
  content: string
  raw: Record<string, unknown>
}

export type QueuedMessage = {
  sender: string
  message_id: string
  type: 'text' | 'audio' | 'image' | 'document'
  content: string
  raw: Record<string, unknown>
  timestamp?: number
}

export type ProviderResponse = {
  messages: QueuedMessage[]
}

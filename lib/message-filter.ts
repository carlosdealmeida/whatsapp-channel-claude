/**
 * Message filtering — determines which WhatsApp messages should be delivered
 * to the Claude Code channel and strips the /claude prefix.
 */

import type { ExtractedMessage } from './types.ts'

const CLAUDE_PREFIX = /^\/claude\b/i

const PERMISSION_REPLY_RE = /^\s*(y|yes|n|no|sim|s)\s+[a-km-z]{5}\s*$/i

/**
 * Returns true if the message should be forwarded to the Claude Code channel.
 *
 * Criteria:
 * - Text starting with /claude
 * - Permission reply (yes/no + 5-letter request ID)
 * - Audio or image that is a reply to a bot message (has contextInfo)
 * - Image with caption starting with /claude
 */
export function isClaudeChannelMessage(message: ExtractedMessage): boolean {
  const { type, content, raw } = message

  // Text with /claude prefix
  if (type === 'text' && CLAUDE_PREFIX.test(content.trim())) {
    return true
  }

  // Permission reply (always passes through)
  if (type === 'text' && PERMISSION_REPLY_RE.test(content)) {
    return true
  }

  // Audio or image that is a reply to a bot message
  if (type === 'audio' || type === 'image') {
    const rawMsg = (raw.message ?? {}) as Record<string, unknown>
    const typeKey = type === 'audio' ? 'audioMessage' : 'imageMessage'
    const typeMsg = (rawMsg[typeKey] ?? {}) as Record<string, unknown>
    const contextInfo = typeMsg.contextInfo
    if (contextInfo) {
      return true
    }

    // Image with /claude caption
    if (type === 'image' && CLAUDE_PREFIX.test(content.trim())) {
      return true
    }
  }

  return false
}

/**
 * Strips the /claude prefix from message content and extracts the target project.
 *
 * If the first word after /claude matches a registered project name,
 * it is extracted as the target project and removed from the content.
 *
 * @returns { content: cleaned message, project: target project name }
 */
export function stripClaudePrefix(
  content: string,
  registeredProjects?: Set<string>,
): { content: string; project: string } {
  let project = 'default'

  if (!CLAUDE_PREFIX.test(content.trim())) {
    return { content, project }
  }

  // Remove /claude prefix
  let afterPrefix = content.trim().replace(/^\/claude\s*/i, '').trim()

  // Check if next word matches a registered project
  if (registeredProjects?.size && afterPrefix) {
    const firstWord = afterPrefix.split(/\s+/)[0].toLowerCase()
    if (registeredProjects.has(firstWord)) {
      project = firstWord
      afterPrefix = afterPrefix.slice(firstWord.length).trim()
    }
  }

  return {
    content: afterPrefix || '(empty message)',
    project,
  }
}

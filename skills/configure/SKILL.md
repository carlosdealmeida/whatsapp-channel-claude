---
name: configure
description: Configure the WhatsApp channel — set Evolution API credentials, provider mode, and Groq API key. Use when the user asks to set up or change WhatsApp channel settings.
user-invocable: true
allowed-tools:
  - Read
  - Write
  - Bash(mkdir *)
---

# /whatsapp:configure — WhatsApp Channel Configuration

Manages configuration for the WhatsApp channel. All config lives in
`~/.claude/channels/whatsapp/.env`.

Arguments passed: `$ARGUMENTS`

---

## .env format

```
EVOLUTION_API_URL=https://your-evolution-api.example.com
EVOLUTION_API_INSTANCE=YourInstance
EVOLUTION_API_KEY=your-api-key
PROVIDER_MODE=n8n
PROVIDER_URL=http://localhost:5678/webhook/whatsapp-claude-poll
WHATSAPP_WEBHOOK_PORT=9801
GROQ_API_KEY=your-groq-key
GROQ_LANGUAGE=en
```

## Dispatch on arguments

Parse `$ARGUMENTS` (space-separated). If empty, show current status.

### No args — status

1. Read `~/.claude/channels/whatsapp/.env` (handle missing file).
2. Show: Evolution API URL, instance name, whether API key is set
   (don't show the key), provider mode, provider URL, webhook port,
   whether GROQ_API_KEY is set, language setting.

### `evolution-url <url>`

Set EVOLUTION_API_URL. Write back. Confirm.

### `evolution-instance <name>`

Set EVOLUTION_API_INSTANCE. Write back. Confirm.

### `evolution-key <key>`

Set EVOLUTION_API_KEY. Write back. Confirm.

### `provider-mode <mode>`

Set PROVIDER_MODE. Valid values: `n8n`, `webhook`, `custom`. Write back. Confirm.
If `webhook`, remind user to point Evolution API webhook to `http://localhost:<port>/webhook/whatsapp`.
If `custom`, remind user to set PROVIDER_URL.

### `provider-url <url>`

Set PROVIDER_URL. Write back. Confirm.

### `port <number>`

Set WHATSAPP_WEBHOOK_PORT. Write back. Confirm.

### `groq-key <key>`

Set GROQ_API_KEY. Write back. Confirm.

### `language <code>`

Set GROQ_LANGUAGE. Write back. Confirm.

### `setup`

Interactive setup — ask for each value one by one:
1. Evolution API URL
2. Instance name (default: YourInstance)
3. Evolution API key
4. Provider mode (default: n8n)
5. Provider URL (if mode is n8n or custom)
6. Webhook port (if mode is webhook, default: 9801)
7. Groq API key (optional, for audio transcription)
8. Language (default: en)

Write all values to .env.

## Implementation notes

- Create `~/.claude/channels/whatsapp/` directory if it doesn't exist.
- Preserve existing values when updating a single key.
- Channel re-reads .env on startup. Tell user to restart after changes.

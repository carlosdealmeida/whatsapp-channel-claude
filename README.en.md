🌐 [English](README.en.md) | [Português](README.md) | [Español](README.es.md)

# WhatsApp Channel for Claude Code

A WhatsApp channel for [Claude Code](https://docs.anthropic.com/en/docs/claude-code) via [Evolution API](https://github.com/EvolutionAPI/evolution-api). Send messages prefixed with `/claude` on WhatsApp and they'll be delivered to your Claude Code session.

## What are Claude Code Channels?

> **Requirements:** Channels are in [research preview](https://docs.anthropic.com/en/docs/claude-code/channels) and require **Claude Code v2.1.80 or later**. Permission relay requires **v2.1.81+**. They require claude.ai login — Console and API key authentication is not supported.

[Channels](https://docs.anthropic.com/en/docs/claude-code/channels) are an experimental Claude Code feature that lets external messaging platforms (WhatsApp, Telegram, Slack, etc.) communicate with a running Claude Code session via MCP servers. A channel acts as a bridge: it receives messages from an external source, delivers them to Claude as notifications, and provides tools for Claude to respond back.

When you start Claude Code with `--dangerously-load-development-channels server:<name>`, it loads the channel's MCP server and enables two-way communication. Messages arrive as `<channel>` notifications that Claude can read and respond to using the channel's tools.

This is currently a development feature — hence the `--dangerously-load-development-channels` flag. It requires explicit opt-in and should be used with proper access controls in place.

### Official vs Community Channels

Claude Code ships with four official channels in the [research preview](https://docs.anthropic.com/en/docs/claude-code/channels):
- **Telegram** — built-in, maintained by Anthropic
- **Discord** — built-in, maintained by Anthropic
- **iMessage** — built-in, maintained by Anthropic (macOS only)
- **fakechat** — demo/testing channel with a web UI

These are on the approved allowlist and can be loaded with `--channels`. Source code is available at [claude-plugins-official](https://github.com/anthropics/claude-plugins-official/tree/main/external_plugins).

**WhatsApp is not an official channel.** This is a community-built channel that uses the same MCP channel protocol. It relies on [Evolution API](https://github.com/EvolutionAPI/evolution-api) as a WhatsApp gateway (which itself uses the unofficial WhatsApp Web API). Because it is not on the approved allowlist, it requires the `--dangerously-load-development-channels` flag to run. Use it at your own discretion.

## Features
- **Pluggable message provider** — n8n, direct webhook, or custom HTTP
- **Two-way communication** — receive messages and reply via WhatsApp
- **Permission relay** — approve/deny tool use from WhatsApp
- **Audio transcription** — voice messages transcribed via Groq Whisper
- **Image attachments** — photos saved to local inbox
- **Access control** — allowlist or open policy
- **Project routing** — route messages to specific Claude Code sessions

## Architecture

```
┌──────────────────────────┐
│   Evolution API          │
│   (WhatsApp gateway)     │
└────────────┬─────────────┘
             │ webhook POST
             ▼
┌──────────────────────────┐
│   Message Provider       │  ← pluggable
│   (n8n / webhook / custom)│
│                          │
│   POST /webhook/whatsapp │  ← receives from Evolution
│   GET  /pending?project= │  ← channel polls here
└────────────┬─────────────┘
             │ HTTP polling (3s)
             ▼
┌──────────────────────────┐
│  WhatsApp Channel        │
│  (MCP Server / Bun)      │
│                          │
│  → Delivers messages     │
│    to Claude Code        │
│  → Sends replies via     │
│    Evolution API         │
└──────────────────────────┘
```

### Provider Modes

| Mode | Config | How it works |
|------|--------|-------------|
| `n8n` (default) | `PROVIDER_URL=http://localhost:5678/webhook/whatsapp-claude-poll` | n8n receives webhook, filters, stores. Channel polls n8n. |
| `webhook` | `PROVIDER_MODE=webhook` | Channel runs its own HTTP server, receives webhooks directly from Evolution API. Zero external dependencies. |
| `custom` | `PROVIDER_URL=https://your-api.example.com` | Any HTTP service that returns the expected format. |

## Quick Start: n8n Mode (Recommended)

### 1. Import the n8n workflow

1. Open your n8n instance
2. **Workflows** → **Import from File** → select `n8n/whatsapp-channel.json`
3. Activate the workflow

### 2. Configure Evolution API webhook

Point your Evolution API instance webhook to:
```
http://your-n8n-host:5678/webhook/whatsapp-claude-webhook
```
Subscribe to the `MESSAGES_UPSERT` event.

### 3. Set environment variables

Create `~/.claude/channels/whatsapp/.env`:
```
EVOLUTION_API_URL=https://your-evolution-api.example.com
EVOLUTION_API_INSTANCE=YourInstance
EVOLUTION_API_KEY=your-api-key
```

Or use the setup skill: `/whatsapp:configure setup`

### 4. Allow your phone number

```
/whatsapp:access allow 5521999999999
```

### 5. Add to Claude Code

```bash
claude mcp add whatsapp -- bun /path/to/whatsapp-channel-claude/server.ts
```

Or manually in `~/.claude/settings.json`:
```json
{
  "mcpServers": {
    "whatsapp": {
      "command": "bun",
      "args": ["/path/to/whatsapp-channel-claude/server.ts"]
    }
  }
}
```

### 6. Start Claude Code with the channel

```bash
claude --dangerously-load-development-channels server:whatsapp
```

### 7. Send a message

In WhatsApp, send: `/claude hello world`

## Quick Start: Direct Webhook Mode

No n8n needed — the channel runs its own HTTP server.

### 1. Set environment variables

```
EVOLUTION_API_URL=https://your-evolution-api.example.com
EVOLUTION_API_INSTANCE=YourInstance
EVOLUTION_API_KEY=your-api-key
PROVIDER_MODE=webhook
WHATSAPP_WEBHOOK_PORT=9801
```

### 2. Configure Evolution API webhook

Point your Evolution API to:
```
http://your-server:9801/webhook/whatsapp
```

### 3. Add to Claude Code and allow your number

Same as steps 4-5 above.

## Quick Start: Custom Provider

Build your own message provider that implements the API contract below.

```
PROVIDER_MODE=custom
PROVIDER_URL=https://your-api.example.com
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `EVOLUTION_API_URL` | *(required)* | Evolution API base URL |
| `EVOLUTION_API_INSTANCE` | `YourInstance` | Evolution API instance name |
| `EVOLUTION_API_KEY` | *(required)* | Evolution API key |
| `PROVIDER_MODE` | `n8n` | Provider mode: `n8n`, `webhook`, or `custom` |
| `PROVIDER_URL` | `http://localhost:5678/webhook/whatsapp-claude-poll` | Provider polling URL (n8n/custom modes) |
| `WHATSAPP_WEBHOOK_PORT` | `9801` | HTTP server port (webhook mode only) |
| `WHATSAPP_PROJECT` | `default` | Project name for message routing |
| `WHATSAPP_POLL_INTERVAL_MS` | `3000` | Polling interval in milliseconds |
| `GROQ_API_KEY` | *(empty)* | Groq API key for audio transcription |
| `GROQ_LANGUAGE` | `en` | Whisper language code (e.g., `en`, `pt`, `es`) |
| `WHATSAPP_STATE_DIR` | `~/.claude/channels/whatsapp` | State directory override |

## Message Provider API Contract

Any HTTP service can be a message provider. It must implement:

### `GET /pending?project=<name>`

Returns pending messages for a project. Messages are drained (removed) after being returned.

**Response:**
```json
{
  "messages": [
    {
      "sender": "5521999999999",
      "message_id": "3EB0AC3F...",
      "type": "text",
      "content": "message without /claude prefix",
      "raw": {}
    }
  ]
}
```

**Message types:** `text`, `audio`, `image`, `document`

The provider is responsible for:
- Filtering (only `/claude`-prefixed messages)
- Stripping the `/claude` prefix
- Routing by project name
- TTL / cleanup of old messages

### `POST /webhook/whatsapp` (webhook mode only)

Receives the raw Evolution API payload. Only needed if using the built-in webhook server.

## Building a Custom Provider

1. Receive webhooks from Evolution API (`messages.upsert` events)
2. Filter for messages starting with `/claude`
3. Strip the `/claude` prefix
4. Queue by project name (first word after `/claude` if it matches a registered project)
5. Serve `GET /pending?project=<name>` that drains the queue
6. Apply a TTL (recommended: 1 hour) to prevent unbounded growth

See `lib/message-filter.ts` for the filtering logic and `lib/webhook-server.ts` for a reference implementation.

## Access Control

Access is managed via `~/.claude/channels/whatsapp/access.json`:

```json
{
  "policy": "allowlist",
  "allowFrom": ["5521999999999"]
}
```

**Policies:**
- `allowlist` (default) — only listed phone numbers can interact
- `open` — all incoming messages are forwarded

Use the skill to manage: `/whatsapp:access allow <phone>`

## Audio Transcription

Voice messages are automatically transcribed using [Groq Whisper](https://console.groq.com/). Set `GROQ_API_KEY` in your `.env`.

The language defaults to `en`. Change it with `GROQ_LANGUAGE=pt` (or any ISO 639-1 code).

Without a Groq key, audio messages are marked for manual download via the `download_attachment` tool.

## Permission Relay

When Claude Code needs tool approval, it sends a formatted message to all allowlisted numbers. Reply with `yes <id>` or `no <id>` to approve or deny.

Permission replies don't need the `/claude` prefix — they're automatically detected by the pattern: `yes/no/sim + 5-letter ID`.

## n8n Workflow Details

The included workflow has two paths:

1. **Webhook receiver** — `POST /whatsapp-claude-webhook` processes Evolution API payloads, filters, and queues messages in n8n static data
2. **Polling endpoint** — `GET /whatsapp-claude-poll?project=<name>` drains queued messages

See `n8n/README.md` for detailed setup instructions.

## License

MIT

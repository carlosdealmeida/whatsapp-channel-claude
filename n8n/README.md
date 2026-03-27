# n8n Workflow for WhatsApp Channel

This n8n workflow acts as the message provider between Evolution API and the WhatsApp channel for Claude Code.

## How It Works

The workflow has two paths:

**Path A — Receive webhook from Evolution API:**
1. `POST /whatsapp-claude-webhook` receives the Evolution API payload
2. Filters for `/claude`-prefixed messages, permission replies, and audio/image replies
3. Strips the `/claude` prefix and queues the message in n8n static data

**Path B — Polling endpoint for the channel:**
1. `GET /whatsapp-claude-poll?project=<name>` is called by the channel every 3 seconds
2. Drains the message queue for the requested project
3. Returns messages in the provider contract format

## Setup

### 1. Import the workflow

1. Open your n8n instance
2. Go to **Workflows** → **Import from File**
3. Select `whatsapp-channel.json`
4. Activate the workflow

### 2. Configure Evolution API webhook

In your Evolution API instance settings, add a webhook pointing to:

```
http://your-n8n-host:5678/webhook/whatsapp-claude-webhook
```

Subscribe to the `MESSAGES_UPSERT` event.

### 3. Configure the channel

Set these environment variables in `~/.claude/channels/whatsapp/.env`:

```
PROVIDER_MODE=n8n
PROVIDER_URL=http://localhost:5678/webhook/whatsapp-claude-poll
```

Or just use the defaults — n8n mode with `localhost:5678` is the default configuration.

## Message Queue

Messages are stored in n8n's workflow static data (in-memory). They have a 1-hour TTL and are automatically cleaned up on drain.

If n8n restarts, the queue is lost. This is by design — WhatsApp messages are ephemeral and the channel is expected to be running alongside n8n.

## Project Routing

The workflow supports routing messages to specific projects. When a user sends `/claude myproject hello`, the message is queued under the `myproject` key. The channel polls with `?project=myproject` and receives both project-specific and default messages.

To add project routing, edit the "Filter & Extract" code node and add your project names to the routing logic.

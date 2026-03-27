🌐 [English](README.en.md) | [Português](README.md) | [Español](README.es.md)

# Canal WhatsApp para Claude Code

Un canal WhatsApp para [Claude Code](https://docs.anthropic.com/en/docs/claude-code) vía [Evolution API](https://github.com/EvolutionAPI/evolution-api). Envía mensajes con el prefijo `/claude` en WhatsApp y serán entregados a tu sesión de Claude Code.

## ¿Qué son los Channels de Claude Code?

> **Requisitos:** Los channels están en [research preview](https://docs.anthropic.com/en/docs/claude-code/channels) y requieren **Claude Code v2.1.80 o superior**. El relay de permisos requiere **v2.1.81+**. Se necesita login vía claude.ai — la autenticación por Console o API key no está soportada.

[Channels](https://docs.anthropic.com/en/docs/claude-code/channels) son una funcionalidad experimental de Claude Code que permite que plataformas de mensajería externas (WhatsApp, Telegram, Slack, etc.) se comuniquen con una sesión activa de Claude Code a través de servidores MCP. Un channel actúa como un puente: recibe mensajes de una fuente externa, los entrega a Claude como notificaciones y proporciona herramientas para que Claude responda.

Cuando inicias Claude Code con `--dangerously-load-development-channels server:<nombre>`, carga el servidor MCP del channel y habilita la comunicación bidireccional. Los mensajes llegan como notificaciones `<channel>` que Claude puede leer y responder usando las herramientas del channel.

Esta es actualmente una funcionalidad de desarrollo — de ahí la flag `--dangerously-load-development-channels`. Requiere opt-in explícito y debe usarse con controles de acceso adecuados.

### Channels Oficiales vs Comunidad

Claude Code incluye cuatro channels oficiales en el [research preview](https://docs.anthropic.com/en/docs/claude-code/channels):
- **Telegram** — integrado, mantenido por Anthropic
- **Discord** — integrado, mantenido por Anthropic
- **iMessage** — integrado, mantenido por Anthropic (solo macOS)
- **fakechat** — channel de demo/pruebas con interfaz web

Estos están en la allowlist aprobada y pueden cargarse con `--channels`. El código fuente está disponible en [claude-plugins-official](https://github.com/anthropics/claude-plugins-official/tree/main/external_plugins).

**WhatsApp no es un channel oficial.** Este es un channel construido por la comunidad que usa el mismo protocolo MCP de channels. Depende de [Evolution API](https://github.com/EvolutionAPI/evolution-api) como gateway de WhatsApp (que a su vez usa la API no oficial de WhatsApp Web). Al no estar en la allowlist aprobada, requiere la flag `--dangerously-load-development-channels` para funcionar. Úselo bajo su propia responsabilidad.

## Funcionalidades
- **Message provider conectable** — n8n, webhook directo o HTTP personalizado
- **Comunicación bidireccional** — recibe mensajes y responde vía WhatsApp
- **Relay de permisos** — aprueba/deniega uso de herramientas desde WhatsApp
- **Transcripción de audio** — mensajes de voz transcritos vía Groq Whisper
- **Adjuntos de imagen** — fotos guardadas en el inbox local
- **Control de acceso** — política allowlist o abierta
- **Enrutamiento por proyecto** — dirige mensajes a sesiones específicas de Claude Code

## Arquitectura

```
┌──────────────────────────┐
│   Evolution API          │
│   (Gateway WhatsApp)     │
└────────────┬─────────────┘
             │ webhook POST
             ▼
┌──────────────────────────┐
│   Message Provider       │  ← conectable
│   (n8n / webhook / custom)│
│                          │
│   POST /webhook/whatsapp │  ← recibe de Evolution
│   GET  /pending?project= │  ← el channel hace polling aquí
└────────────┬─────────────┘
             │ HTTP polling (3s)
             ▼
┌──────────────────────────┐
│  Canal WhatsApp          │
│  (MCP Server / Bun)      │
│                          │
│  → Entrega mensajes      │
│    a Claude Code         │
│  → Envía respuestas vía  │
│    Evolution API         │
└──────────────────────────┘
```

### Modos de Provider

| Modo | Configuración | Cómo funciona |
|------|--------------|---------------|
| `n8n` (predeterminado) | `PROVIDER_URL=http://localhost:5678/webhook/whatsapp-claude-poll` | n8n recibe webhook, filtra y almacena. El channel hace polling a n8n. |
| `webhook` | `PROVIDER_MODE=webhook` | El channel ejecuta su propio servidor HTTP, recibe webhooks directamente de Evolution API. Cero dependencias externas. |
| `custom` | `PROVIDER_URL=https://your-api.example.com` | Cualquier servicio HTTP que retorne el formato esperado. |

## Inicio Rápido: Modo n8n (Recomendado)

### 1. Importa el workflow n8n

1. Abre tu instancia de n8n
2. **Workflows** → **Import from File** → selecciona `n8n/whatsapp-channel.json`
3. Activa el workflow

### 2. Configura el webhook de Evolution API

Apunta el webhook de tu instancia Evolution API a:
```
http://tu-host-n8n:5678/webhook/whatsapp-claude-webhook
```
Suscríbete al evento `MESSAGES_UPSERT`.

### 3. Configura las variables de entorno

Crea `~/.claude/channels/whatsapp/.env`:
```
EVOLUTION_API_URL=https://tu-evolution-api.example.com
EVOLUTION_API_INSTANCE=TuInstancia
EVOLUTION_API_KEY=tu-api-key
```

O usa la skill de configuración: `/whatsapp:configure setup`

### 4. Autoriza tu número de teléfono

```
/whatsapp:access allow 5521999999999
```

### 5. Agrega a Claude Code

```bash
claude mcp add whatsapp -- bun /ruta/a/whatsapp-channel-claude/server.ts
```

O manualmente en `~/.claude/settings.json`:
```json
{
  "mcpServers": {
    "whatsapp": {
      "command": "bun",
      "args": ["/ruta/a/whatsapp-channel-claude/server.ts"]
    }
  }
}
```

### 6. Inicia Claude Code con el canal

```bash
claude --dangerously-load-development-channels server:whatsapp
```

### 7. Envía un mensaje

En WhatsApp, envía: `/claude hola mundo`

## Inicio Rápido: Modo Webhook Directo

Sin necesidad de n8n — el channel ejecuta su propio servidor HTTP.

### 1. Configura las variables de entorno

```
EVOLUTION_API_URL=https://tu-evolution-api.example.com
EVOLUTION_API_INSTANCE=TuInstancia
EVOLUTION_API_KEY=tu-api-key
PROVIDER_MODE=webhook
WHATSAPP_WEBHOOK_PORT=9801
```

### 2. Configura el webhook de Evolution API

Apunta tu Evolution API a:
```
http://tu-servidor:9801/webhook/whatsapp
```

### 3. Agrega a Claude Code y autoriza tu número

Igual que los pasos 4-5 anteriores.

## Inicio Rápido: Provider Personalizado

Construye tu propio message provider que implemente el contrato de API a continuación.

```
PROVIDER_MODE=custom
PROVIDER_URL=https://tu-api.example.com
```

## Variables de Entorno

| Variable | Predeterminado | Descripción |
|----------|---------------|-------------|
| `EVOLUTION_API_URL` | *(requerido)* | URL base de Evolution API |
| `EVOLUTION_API_INSTANCE` | `YourInstance` | Nombre de la instancia Evolution API |
| `EVOLUTION_API_KEY` | *(requerido)* | Clave de Evolution API |
| `PROVIDER_MODE` | `n8n` | Modo del provider: `n8n`, `webhook` o `custom` |
| `PROVIDER_URL` | `http://localhost:5678/webhook/whatsapp-claude-poll` | URL de polling del provider (modos n8n/custom) |
| `WHATSAPP_WEBHOOK_PORT` | `9801` | Puerto del servidor HTTP (solo modo webhook) |
| `WHATSAPP_PROJECT` | `default` | Nombre del proyecto para enrutamiento de mensajes |
| `WHATSAPP_POLL_INTERVAL_MS` | `3000` | Intervalo de polling en milisegundos |
| `GROQ_API_KEY` | *(vacío)* | Clave API de Groq para transcripción de audio |
| `GROQ_LANGUAGE` | `en` | Código de idioma de Whisper (ej.: `en`, `pt`, `es`) |
| `WHATSAPP_STATE_DIR` | `~/.claude/channels/whatsapp` | Override del directorio de estado |

## Contrato de API del Message Provider

Cualquier servicio HTTP puede ser un message provider. Debe implementar:

### `GET /pending?project=<nombre>`

Retorna mensajes pendientes para un proyecto. Los mensajes son drenados (eliminados) después de ser retornados.

**Respuesta:**
```json
{
  "messages": [
    {
      "sender": "5521999999999",
      "message_id": "3EB0AC3F...",
      "type": "text",
      "content": "mensaje sin el prefijo /claude",
      "raw": {}
    }
  ]
}
```

**Tipos de mensaje:** `text`, `audio`, `image`, `document`

El provider es responsable de:
- Filtrar (solo mensajes con prefijo `/claude`)
- Eliminar el prefijo `/claude`
- Enrutar por nombre de proyecto
- TTL / limpieza de mensajes antiguos

### `POST /webhook/whatsapp` (solo modo webhook)

Recibe el payload crudo de Evolution API. Solo necesario si se usa el servidor webhook integrado.

## Construyendo un Provider Personalizado

1. Recibe webhooks de Evolution API (eventos `messages.upsert`)
2. Filtra mensajes que comienzan con `/claude`
3. Elimina el prefijo `/claude`
4. Encola por nombre de proyecto (primera palabra después de `/claude` si coincide con un proyecto registrado)
5. Sirve `GET /pending?project=<nombre>` que drena la cola
6. Aplica un TTL (recomendado: 1 hora) para evitar crecimiento ilimitado

Consulta `lib/message-filter.ts` para la lógica de filtrado y `lib/webhook-server.ts` para una implementación de referencia.

## Control de Acceso

El acceso se gestiona vía `~/.claude/channels/whatsapp/access.json`:

```json
{
  "policy": "allowlist",
  "allowFrom": ["5521999999999"]
}
```

**Políticas:**
- `allowlist` (predeterminado) — solo los números listados pueden interactuar
- `open` — todos los mensajes entrantes son reenviados

Usa la skill para gestionar: `/whatsapp:access allow <teléfono>`

## Transcripción de Audio

Los mensajes de voz se transcriben automáticamente usando [Groq Whisper](https://console.groq.com/). Configura `GROQ_API_KEY` en tu `.env`.

El idioma predeterminado es `en`. Cámbialo con `GROQ_LANGUAGE=es` (o cualquier código ISO 639-1).

Sin una clave Groq, los mensajes de audio se marcan para descarga manual vía la herramienta `download_attachment`.

## Relay de Permisos

Cuando Claude Code necesita aprobación de herramientas, envía un mensaje formateado a todos los números autorizados. Responde con `yes <id>` o `no <id>` para aprobar o denegar.

Las respuestas de permisos no necesitan el prefijo `/claude` — se detectan automáticamente por el patrón: `yes/no/sim + ID de 5 letras`.

## Detalles del Workflow n8n

El workflow incluido tiene dos caminos:

1. **Receptor de webhook** — `POST /whatsapp-claude-webhook` procesa payloads de Evolution API, filtra y encola mensajes en los datos estáticos de n8n
2. **Endpoint de polling** — `GET /whatsapp-claude-poll?project=<nombre>` drena mensajes encolados

Consulta `n8n/README.md` para instrucciones detalladas de configuración.

## Licencia

MIT

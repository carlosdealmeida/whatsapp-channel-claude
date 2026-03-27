🌐 [English](README.en.md) | [Português](README.md) | [Español](README.es.md)

# Canal WhatsApp para Claude Code

Um canal WhatsApp para o [Claude Code](https://docs.anthropic.com/en/docs/claude-code) via [Evolution API](https://github.com/EvolutionAPI/evolution-api). Envie mensagens com o prefixo `/claude` no WhatsApp e elas serão entregues à sua sessão do Claude Code.

## O que são Channels do Claude Code?

[Channels](https://docs.anthropic.com/en/docs/claude-code/channels) são uma funcionalidade experimental do Claude Code que permite que plataformas de mensagens externas (WhatsApp, Telegram, Slack, etc.) se comuniquem com uma sessão ativa do Claude Code via servidores MCP. Um channel atua como uma ponte: recebe mensagens de uma fonte externa, entrega-as ao Claude como notificações e fornece ferramentas para o Claude responder de volta.

Quando você inicia o Claude Code com `--dangerously-load-development-channels server:<nome>`, ele carrega o servidor MCP do channel e habilita a comunicação bidirecional. As mensagens chegam como notificações `<channel>` que o Claude pode ler e responder usando as ferramentas do channel.

Esta é atualmente uma funcionalidade de desenvolvimento — daí a flag `--dangerously-load-development-channels`. Requer opt-in explícito e deve ser usada com controles de acesso adequados.

### Channels Oficiais vs Comunidade

O Claude Code inclui quatro channels oficiais no [research preview](https://docs.anthropic.com/en/docs/claude-code/channels):
- **Telegram** — integrado, mantido pela Anthropic
- **Discord** — integrado, mantido pela Anthropic
- **iMessage** — integrado, mantido pela Anthropic (apenas macOS)
- **fakechat** — channel de demo/teste com interface web

Estes estão na allowlist aprovada e podem ser carregados com `--channels`. O código-fonte está disponível em [claude-plugins-official](https://github.com/anthropics/claude-plugins-official/tree/main/external_plugins).

**WhatsApp não é um channel oficial.** Este é um channel construído pela comunidade que usa o mesmo protocolo MCP de channels. Ele depende da [Evolution API](https://github.com/EvolutionAPI/evolution-api) como gateway do WhatsApp (que por sua vez usa a API não-oficial do WhatsApp Web). Por não estar na allowlist aprovada, requer a flag `--dangerously-load-development-channels` para funcionar. Use por sua conta e risco.

## Funcionalidades
- **Message provider plugável** — n8n, webhook direto ou HTTP customizado
- **Comunicação bidirecional** — receba mensagens e responda via WhatsApp
- **Relay de permissões** — aprove/negue uso de ferramentas pelo WhatsApp
- **Transcrição de áudio** — mensagens de voz transcritas via Groq Whisper
- **Anexos de imagem** — fotos salvas no inbox local
- **Controle de acesso** — política allowlist ou aberta
- **Roteamento por projeto** — direcione mensagens para sessões específicas do Claude Code

## Arquitetura

```
┌──────────────────────────┐
│   Evolution API          │
│   (Gateway WhatsApp)     │
└────────────┬─────────────┘
             │ webhook POST
             ▼
┌──────────────────────────┐
│   Message Provider       │  ← plugável
│   (n8n / webhook / custom)│
│                          │
│   POST /webhook/whatsapp │  ← recebe da Evolution
│   GET  /pending?project= │  ← channel faz polling aqui
└────────────┬─────────────┘
             │ HTTP polling (3s)
             ▼
┌──────────────────────────┐
│  Canal WhatsApp          │
│  (MCP Server / Bun)      │
│                          │
│  → Entrega mensagens     │
│    ao Claude Code        │
│  → Envia respostas via   │
│    Evolution API         │
└──────────────────────────┘
```

### Modos de Provider

| Modo | Configuração | Como funciona |
|------|-------------|---------------|
| `n8n` (padrão) | `PROVIDER_URL=http://localhost:5678/webhook/whatsapp-claude-poll` | n8n recebe webhook, filtra e armazena. Channel faz polling no n8n. |
| `webhook` | `PROVIDER_MODE=webhook` | Channel roda seu próprio servidor HTTP, recebe webhooks diretamente da Evolution API. Zero dependências externas. |
| `custom` | `PROVIDER_URL=https://your-api.example.com` | Qualquer serviço HTTP que retorne o formato esperado. |

## Início Rápido: Modo n8n (Recomendado)

### 1. Importe o workflow n8n

1. Abra sua instância do n8n
2. **Workflows** → **Import from File** → selecione `n8n/whatsapp-channel.json`
3. Ative o workflow

### 2. Configure o webhook da Evolution API

Aponte o webhook da sua instância Evolution API para:
```
http://seu-host-n8n:5678/webhook/whatsapp-claude-webhook
```
Inscreva-se no evento `MESSAGES_UPSERT`.

### 3. Configure as variáveis de ambiente

Crie `~/.claude/channels/whatsapp/.env`:
```
EVOLUTION_API_URL=https://sua-evolution-api.example.com
EVOLUTION_API_INSTANCE=SuaInstancia
EVOLUTION_API_KEY=sua-api-key
```

Ou use a skill de configuração: `/whatsapp:configure setup`

### 4. Autorize seu número de telefone

```
/whatsapp:access allow 5521999999999
```

### 5. Adicione ao Claude Code

```bash
claude mcp add whatsapp -- bun /caminho/para/whatsapp-channel-claude/server.ts
```

Ou manualmente em `~/.claude/settings.json`:
```json
{
  "mcpServers": {
    "whatsapp": {
      "command": "bun",
      "args": ["/caminho/para/whatsapp-channel-claude/server.ts"]
    }
  }
}
```

### 6. Inicie o Claude Code com o canal

```bash
claude --dangerously-load-development-channels server:whatsapp
```

### 7. Envie uma mensagem

No WhatsApp, envie: `/claude olá mundo`

## Início Rápido: Modo Webhook Direto

Sem necessidade de n8n — o channel roda seu próprio servidor HTTP.

### 1. Configure as variáveis de ambiente

```
EVOLUTION_API_URL=https://sua-evolution-api.example.com
EVOLUTION_API_INSTANCE=SuaInstancia
EVOLUTION_API_KEY=sua-api-key
PROVIDER_MODE=webhook
WHATSAPP_WEBHOOK_PORT=9801
```

### 2. Configure o webhook da Evolution API

Aponte sua Evolution API para:
```
http://seu-servidor:9801/webhook/whatsapp
```

### 3. Adicione ao Claude Code e autorize seu número

Mesmo que os passos 4-5 acima.

## Início Rápido: Provider Customizado

Crie seu próprio message provider que implemente o contrato de API abaixo.

```
PROVIDER_MODE=custom
PROVIDER_URL=https://sua-api.example.com
```

## Variáveis de Ambiente

| Variável | Padrão | Descrição |
|----------|--------|-----------|
| `EVOLUTION_API_URL` | *(obrigatório)* | URL base da Evolution API |
| `EVOLUTION_API_INSTANCE` | `YourInstance` | Nome da instância Evolution API |
| `EVOLUTION_API_KEY` | *(obrigatório)* | Chave da Evolution API |
| `PROVIDER_MODE` | `n8n` | Modo do provider: `n8n`, `webhook` ou `custom` |
| `PROVIDER_URL` | `http://localhost:5678/webhook/whatsapp-claude-poll` | URL de polling do provider (modos n8n/custom) |
| `WHATSAPP_WEBHOOK_PORT` | `9801` | Porta do servidor HTTP (apenas modo webhook) |
| `WHATSAPP_PROJECT` | `default` | Nome do projeto para roteamento de mensagens |
| `WHATSAPP_POLL_INTERVAL_MS` | `3000` | Intervalo de polling em milissegundos |
| `GROQ_API_KEY` | *(vazio)* | Chave da API Groq para transcrição de áudio |
| `GROQ_LANGUAGE` | `en` | Código de idioma do Whisper (ex.: `en`, `pt`, `es`) |
| `WHATSAPP_STATE_DIR` | `~/.claude/channels/whatsapp` | Override do diretório de estado |

## Contrato da API do Message Provider

Qualquer serviço HTTP pode ser um message provider. Ele deve implementar:

### `GET /pending?project=<nome>`

Retorna mensagens pendentes para um projeto. As mensagens são drenadas (removidas) após serem retornadas.

**Resposta:**
```json
{
  "messages": [
    {
      "sender": "5521999999999",
      "message_id": "3EB0AC3F...",
      "type": "text",
      "content": "mensagem sem o prefixo /claude",
      "raw": {}
    }
  ]
}
```

**Tipos de mensagem:** `text`, `audio`, `image`, `document`

O provider é responsável por:
- Filtrar (apenas mensagens com prefixo `/claude`)
- Remover o prefixo `/claude`
- Rotear por nome de projeto
- TTL / limpeza de mensagens antigas

### `POST /webhook/whatsapp` (apenas modo webhook)

Recebe o payload bruto da Evolution API. Necessário apenas se usando o servidor webhook embutido.

## Construindo um Provider Customizado

1. Receba webhooks da Evolution API (eventos `messages.upsert`)
2. Filtre mensagens que começam com `/claude`
3. Remova o prefixo `/claude`
4. Enfileire por nome de projeto (primeira palavra após `/claude` se corresponder a um projeto registrado)
5. Sirva `GET /pending?project=<nome>` que drena a fila
6. Aplique um TTL (recomendado: 1 hora) para evitar crescimento ilimitado

Veja `lib/message-filter.ts` para a lógica de filtragem e `lib/webhook-server.ts` para uma implementação de referência.

## Controle de Acesso

O acesso é gerenciado via `~/.claude/channels/whatsapp/access.json`:

```json
{
  "policy": "allowlist",
  "allowFrom": ["5521999999999"]
}
```

**Políticas:**
- `allowlist` (padrão) — apenas números listados podem interagir
- `open` — todas as mensagens recebidas são encaminhadas

Use a skill para gerenciar: `/whatsapp:access allow <telefone>`

## Transcrição de Áudio

Mensagens de voz são automaticamente transcritas usando [Groq Whisper](https://console.groq.com/). Configure `GROQ_API_KEY` no seu `.env`.

O idioma padrão é `en`. Altere com `GROQ_LANGUAGE=pt` (ou qualquer código ISO 639-1).

Sem uma chave Groq, mensagens de áudio são marcadas para download manual via a ferramenta `download_attachment`.

## Relay de Permissões

Quando o Claude Code precisa de aprovação de ferramenta, ele envia uma mensagem formatada para todos os números autorizados. Responda com `yes <id>` ou `no <id>` para aprovar ou negar.

Respostas de permissão não precisam do prefixo `/claude` — são detectadas automaticamente pelo padrão: `yes/no/sim + ID de 5 letras`.

## Detalhes do Workflow n8n

O workflow incluído tem dois caminhos:

1. **Receptor de webhook** — `POST /whatsapp-claude-webhook` processa payloads da Evolution API, filtra e enfileira mensagens nos dados estáticos do n8n
2. **Endpoint de polling** — `GET /whatsapp-claude-poll?project=<nome>` drena mensagens enfileiradas

Veja `n8n/README.md` para instruções detalhadas de configuração.

## Licença

MIT

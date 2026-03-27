# Security Policy

## Supported Versions

| Version | Supported          |
|---------|--------------------|
| 1.x     | ✅ Yes             |

## Reporting a Vulnerability

If you discover a security vulnerability in this project, please report it responsibly.

**Do NOT open a public issue.**

Instead, use [GitHub Security Advisories](https://github.com/carlosdealmeida/whatsapp-channel-claude/security/advisories/new) to report the vulnerability privately.

### What to include

- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Suggested fix (if any)

### Response time

- **Acknowledgment:** within 48 hours
- **Initial assessment:** within 7 days
- **Fix or mitigation:** depends on severity, typically within 30 days

## Security Considerations

This project has specific security aspects you should be aware of:

### Access Control

- By default, the channel uses an **allowlist policy** — only explicitly approved phone numbers can interact
- The `open` policy forwards all messages — use only in trusted environments
- Access mutations are only accepted from the local terminal, never from channel messages (to prevent prompt injection)

### API Keys & Secrets

- Never commit `.env` files — they are in `.gitignore`
- The channel reads credentials from `~/.claude/channels/whatsapp/.env` with `0600` permissions
- Evolution API keys and Groq API keys should be treated as secrets

### Evolution API

- This project uses [Evolution API](https://github.com/EvolutionAPI/evolution-api) as a WhatsApp gateway
- Evolution API uses the unofficial WhatsApp Web protocol — it is not endorsed by Meta/WhatsApp
- Ensure your Evolution API instance is properly secured and not publicly exposed

### Webhook Security

- In `webhook` mode, the embedded HTTP server listens on the configured port
- Restrict access to the webhook endpoint using firewall rules or reverse proxy authentication
- In `n8n` mode, ensure your n8n instance is properly secured

### Prompt Injection

- The channel gates on sender identity before forwarding messages to Claude
- Permission relay (tool approval) requires matching a 5-letter request ID — random text cannot approve tools
- The access skill refuses modifications requested via channel messages

---

# Política de Segurança (PT-BR)

## Versões Suportadas

| Versão | Suportada          |
|--------|--------------------|
| 1.x    | ✅ Sim             |

## Reportando uma Vulnerabilidade

Se você descobrir uma vulnerabilidade de segurança neste projeto, reporte de forma responsável.

**NÃO abra uma issue pública.**

Use o [GitHub Security Advisories](https://github.com/carlosdealmeida/whatsapp-channel-claude/security/advisories/new) para reportar a vulnerabilidade de forma privada.

### O que incluir

- Descrição da vulnerabilidade
- Passos para reproduzir
- Impacto potencial
- Sugestão de correção (se houver)

### Tempo de resposta

- **Confirmação:** até 48 horas
- **Avaliação inicial:** até 7 dias
- **Correção ou mitigação:** depende da severidade, normalmente até 30 dias

## Considerações de Segurança

### Controle de Acesso

- Por padrão, o canal usa uma **política de allowlist** — apenas números de telefone explicitamente aprovados podem interagir
- A política `open` encaminha todas as mensagens — use apenas em ambientes confiáveis
- Alterações de acesso são aceitas apenas do terminal local, nunca de mensagens do canal (para prevenir prompt injection)

### Chaves de API e Segredos

- Nunca faça commit de arquivos `.env` — eles estão no `.gitignore`
- O canal lê credenciais de `~/.claude/channels/whatsapp/.env` com permissões `0600`
- Chaves da Evolution API e Groq API devem ser tratadas como segredos

### Evolution API

- Este projeto usa a [Evolution API](https://github.com/EvolutionAPI/evolution-api) como gateway do WhatsApp
- A Evolution API usa o protocolo não-oficial do WhatsApp Web — não é endossada pela Meta/WhatsApp
- Garanta que sua instância da Evolution API esteja devidamente protegida e não exposta publicamente

### Segurança do Webhook

- No modo `webhook`, o servidor HTTP embutido escuta na porta configurada
- Restrinja o acesso ao endpoint do webhook usando regras de firewall ou autenticação via proxy reverso
- No modo `n8n`, garanta que sua instância n8n esteja devidamente protegida

### Prompt Injection

- O canal valida a identidade do remetente antes de encaminhar mensagens ao Claude
- O relay de permissões (aprovação de ferramentas) requer correspondência de um ID de 5 letras — texto aleatório não pode aprovar ferramentas
- A skill de acesso recusa modificações solicitadas via mensagens do canal

---

# Política de Seguridad (ES)

## Versiones Soportadas

| Versión | Soportada          |
|---------|--------------------|
| 1.x     | ✅ Sí              |

## Reportar una Vulnerabilidad

Si descubres una vulnerabilidad de seguridad en este proyecto, repórtala de forma responsable.

**NO abras un issue público.**

Usa [GitHub Security Advisories](https://github.com/carlosdealmeida/whatsapp-channel-claude/security/advisories/new) para reportar la vulnerabilidad de forma privada.

### Qué incluir

- Descripción de la vulnerabilidad
- Pasos para reproducir
- Impacto potencial
- Sugerencia de corrección (si hay)

### Tiempo de respuesta

- **Confirmación:** hasta 48 horas
- **Evaluación inicial:** hasta 7 días
- **Corrección o mitigación:** depende de la severidad, normalmente hasta 30 días

## Consideraciones de Seguridad

### Control de Acceso

- Por defecto, el canal usa una **política de allowlist** — solo los números de teléfono explícitamente aprobados pueden interactuar
- La política `open` reenvía todos los mensajes — úsala solo en entornos confiables
- Las modificaciones de acceso solo se aceptan desde la terminal local, nunca desde mensajes del canal (para prevenir prompt injection)

### Claves de API y Secretos

- Nunca hagas commit de archivos `.env` — están en `.gitignore`
- El canal lee credenciales de `~/.claude/channels/whatsapp/.env` con permisos `0600`
- Las claves de Evolution API y Groq API deben tratarse como secretos

### Evolution API

- Este proyecto usa [Evolution API](https://github.com/EvolutionAPI/evolution-api) como gateway de WhatsApp
- Evolution API usa el protocolo no oficial de WhatsApp Web — no está respaldada por Meta/WhatsApp
- Asegúrate de que tu instancia de Evolution API esté debidamente protegida y no expuesta públicamente

### Seguridad del Webhook

- En modo `webhook`, el servidor HTTP integrado escucha en el puerto configurado
- Restringe el acceso al endpoint del webhook usando reglas de firewall o autenticación vía proxy reverso
- En modo `n8n`, asegúrate de que tu instancia n8n esté debidamente protegida

### Prompt Injection

- El canal valida la identidad del remitente antes de reenviar mensajes a Claude
- El relay de permisos (aprobación de herramientas) requiere correspondencia de un ID de 5 letras — texto aleatorio no puede aprobar herramientas
- La skill de acceso rechaza modificaciones solicitadas vía mensajes del canal

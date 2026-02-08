<div align="center">
  <img src="public/icon.png" alt="Attaché Logo" width="120" height="120">

  # Attaché

  **A self-hosted AI assistant with tools, agents, and MCP support.**

  Built with Bun, Vue 3, and the Vercel AI SDK.
</div>

## Features

- **Multiple AI Providers** - Claude, OpenAI, or any OpenAI-compatible API (OpenRouter, Ollama, etc.)
- **Agent System** - Spawn background sub-agents for long-running or parallel tasks
- **MCP Integration** - Connect external tools via the Model Context Protocol (SSE or stdio)
- **Built-in Tools** - Filesystem access, terminal commands, web search (Brave), and file downloads
- **Real-Time Streaming** - WebSocket-based streaming responses
- **Markdown & Syntax Highlighting** - Rendered with markdown-it and Shiki
- **Dark & Light Themes** - System-aware with manual override
- **PWA** - Installable as a standalone app on desktop and mobile
- **First-Run Onboarding** - Interactive setup to configure personality, name, and preferences
- **Security Controls** - Command whitelisting (glob patterns), working directory restrictions, auth rate limiting

## Quick Start

```bash
curl -fsSL https://raw.githubusercontent.com/dssnet/attache/main/install.sh | bash
```

This installs [Bun](https://bun.sh) (if needed), downloads the latest release, and runs the setup wizard which walks you through provider configuration, auth token generation, and optional systemd service installation.

### CLI Commands

```bash
attache install   # Run the setup wizard
attache start     # Start the server (uses systemd if available)
attache upgrade   # Check for updates and upgrade
```

### Development

```bash
git clone https://github.com/dssnet/attache.git
cd attache
bun install
bun run dev:backend    # Backend with auto-reload
bun run dev:frontend   # Vite dev server with HMR
```

In dev mode, Vite proxies API and WebSocket requests from `localhost:5173` to the backend on `localhost:3000`.

## Configuration

Configuration lives in `~/.attache/config.json`, created by `attache install`. Settings can also be changed at runtime through the web UI.

### Model Providers

| Field | Description |
|-------|-------------|
| `type` | `claude`, `openai`, or `custom-openai` |
| `apiUrl` | API base URL (required for `custom-openai`) |
| `apiKey` | Provider API key |
| `model` | Model identifier (e.g. `claude-sonnet-4-20250514`, `gpt-4o`) |
| `maxTokens` | Maximum response tokens |
| `temperature` | Sampling temperature (0.0 - 2.0) |

Multiple providers can be configured and switched between from the UI. Set `models.default` to the one used for new conversations.

### Tools

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `filesystem` | boolean | `false` | Allow the agent to read/write files |
| `terminal` | boolean | `false` | Allow the agent to run shell commands |
| `workingDir` | string | `""` | Base directory for filesystem and terminal operations |
| `limitWorkingDir` | boolean | `true` | Restrict filesystem access to `workingDir` only |
| `commandWhitelist` | string[] | `[]` | Allowed commands. `["*"]` allows all. Supports glob patterns (e.g. `git*`) |
| `braveSearchApiKey` | string | `""` | API key for Brave web search |

### MCP Servers

Connect external tools via MCP. Each server entry supports:

**SSE / Streamable HTTP:**
```json
{
  "mcpServers": {
    "my-server": {
      "type": "sse",
      "description": "What this server does",
      "url": "https://example.com/mcp",
      "headers": { "Authorization": "Bearer ..." }
    }
  }
}
```

**Stdio (local process):**
```json
{
  "mcpServers": {
    "filesystem": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "/tmp"]
    }
  }
}
```

SSE servers also support OAuth authentication (`oauth.clientId`, `oauth.clientSecret`, `oauth.tokenUrl`, `oauth.scopes`).

### Assistant

| Option | Description |
|--------|-------------|
| `assistant.name` | Display name for the AI assistant |
| `assistant.first_run` | Set to `true` to trigger the onboarding flow |

### Debug

| Option | Description |
|--------|-------------|
| `debug.logTokens` | Log token usage to the console |

## Agent System

The main assistant can spawn sub-agents that run in the background. Agents have access to the same tools (filesystem, terminal, web search, MCP) and maintain their own conversation state.

- Agents persist to disk and survive server restarts
- Automatic cleanup after 30 minutes of inactivity
- The main assistant can query agent status and send follow-up messages
- Agent results appear in the chat with expandable details

## Network Access

By default, Attaché binds to `127.0.0.1` (localhost only). To expose it over the network, use a reverse proxy:

```nginx
server {
    listen 443 ssl;
    server_name attache.example.com;

    ssl_certificate     /etc/ssl/certs/your-cert.pem;
    ssl_certificate_key /etc/ssl/private/your-key.pem;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    location /ws {
        proxy_pass http://127.0.0.1:3000/ws;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

## Data Storage

Attaché stores runtime data in `~/.attache/`:

| Path | Contents |
|------|----------|
| `context.json` | Conversation history |
| `USER.md` | User profile (set during onboarding) |
| `agents/` | Persisted agent state |
| `downloads/` | Files created by the assistant |

## Project Structure

```
src/
├── backend/
│   ├── index.ts          # Server entry point
│   ├── server.ts         # Hono HTTP routes
│   ├── websocket.ts      # WebSocket handler
│   ├── ai.ts             # AI streaming and tool loop
│   ├── agent.ts          # Sub-agent lifecycle
│   ├── tools.ts          # Tool definitions and handlers
│   ├── mcp.ts            # MCP client management
│   ├── adapters.ts       # AI provider adapters
│   ├── config.ts         # Config loading, saving, deep merge
│   ├── context.ts        # Conversation persistence
│   ├── compact.ts        # Context auto-compaction
│   ├── user-profile.ts   # User profile (USER.md)
│   └── types.ts          # Shared types
└── frontend/
    ├── App.vue
    ├── views/             # Login and Chat screens
    ├── components/
    │   ├── chat/          # Message list, input, bubbles
    │   ├── sidebar/       # Agent list, actions
    │   ├── modals/        # Settings, agent details, tool calls
    │   └── ui/            # Button, Input, Dropdown, Switch, etc.
    ├── composables/       # useWebSocket, useConfig, useMarkdown, useSlashCommands
    └── style.css          # Tailwind theme variables
```

## Built With

- [Bun](https://bun.sh) - JavaScript runtime
- [Vue 3](https://vuejs.org/) - Frontend framework
- [Hono](https://hono.dev/) - HTTP framework
- [Vercel AI SDK](https://sdk.vercel.ai/) - Unified AI provider interface
- [Tailwind CSS 4](https://tailwindcss.com/) - Styling
- [Shiki](https://shiki.matsu.io/) - Syntax highlighting
- [MCP SDK](https://modelcontextprotocol.io/) - Model Context Protocol client

---

<div align="center">
  Made with ❤️ by <a href="https://github.com/ItzYanick">ItzYanick</a>
</div>

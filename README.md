<p align="center">
  <a href="https://github.com/ChatbotXIO/ChatbotX" target="_blank" rel="noopener">
    <img alt="ChatbotX Logo" src=".github/assets/readme/chatbotx-logo.svg" width="280">
  </a>
</p>

<p align="center">
  <strong>Open-source omnichannel chatbot for agentic workflows via APIs, CLI, and MCP.</strong>
  <br>
  An alternative to Wati, ManyChat, and Respond.io.
</p>

<p align="center">
  <a href="https://chatbotx.io">Website</a>
  |
  <a href="https://cloud.chatbotx.io">Cloud</a>
  |
  <a href="https://chatconnectx.com/">ChatConnectX</a>
  |
  <a href="https://github.com/ChatbotXIO/ChatbotX">Repository</a>
</p>

<p align="center">
  <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white">
  <img alt="Next.js" src="https://img.shields.io/badge/Next.js-000000?logo=nextdotjs&logoColor=white">
  <img alt="Turborepo" src="https://img.shields.io/badge/Turborepo-EF4444?logo=turborepo&logoColor=white">
  <img alt="pnpm" src="https://img.shields.io/badge/pnpm-F69220?logo=pnpm&logoColor=white">
  <img alt="PostgreSQL" src="https://img.shields.io/badge/PostgreSQL-4169E1?logo=postgresql&logoColor=white">
  <img alt="Redis" src="https://img.shields.io/badge/Redis-DC382D?logo=redis&logoColor=white">
  <img alt="Docker" src="https://img.shields.io/badge/Docker-2496ED?logo=docker&logoColor=white">
  <img alt="MCP" src="https://img.shields.io/badge/MCP-111827">
</p>

<p align="center">
  <img alt="WhatsApp" src=".github/assets/readme/whatsapp.svg" width="32">
  <img alt="Messenger" src=".github/assets/readme/messenger.svg" width="32">
  <img alt="Instagram" src=".github/assets/readme/instagram.svg" width="32">
  <img alt="Telegram" src=".github/assets/readme/telegram.svg" width="32">
  <img alt="Zalo" src=".github/assets/readme/zalo.svg" width="32">
  <img alt="TikTok" src=".github/assets/readme/tiktok.svg" width="32">
  <img alt="Email" src=".github/assets/readme/email.svg" width="32">
  <img alt="Website" src=".github/assets/readme/website.svg" width="32">
</p>

<p align="center">
  <img alt="ChatbotX omnichannel AI chatbot hero" src=".github/assets/readme/chatbotx-hero-16x9.png">
</p>

## About

ChatbotX is a Node.js and TypeScript monorepo for building, running, and extending an omnichannel chatbot platform. It brings together a web builder, background workers, realtime messaging, channel integrations, public APIs, a CLI, and an MCP server.

Use ChatbotX to automate conversations across WhatsApp, Messenger, Instagram, Telegram, Zalo, Webchat, Email, and other channels. Teams can design Flows, run AI Agents, manage a shared Inbox, send Broadcasts, schedule Sequences, trigger Webhooks, and sync customer data through integrations.

## ✨ Features

- **Omnichannel Inbox:** Manage customer conversations from supported messaging channels in one workspace.
- **Flow builder:** Build automated chatbot flows for qualification, support, routing, follow-up, and data capture.
- **AI Agents:** Connect AI providers and knowledge workflows to answer questions, analyze inputs, generate content, and hand off to humans.
- **Broadcasts and Sequences:** Send campaigns, schedule follow-ups, and track channel-level delivery workflows.
- **Triggers and Webhooks:** React to events and connect ChatbotX with external systems.
- **Public APIs, CLI, and MCP:** Automate ChatbotX from scripts, agent workflows, and MCP-compatible clients.
- **Integrations:** Includes channel and app integrations such as WhatsApp, Messenger, Instagram, Telegram, Zalo, Webchat, SMTP, OpenAI, and Google Sheets.

<table>
  <tr>
    <td width="50%" align="center" valign="top">
      <strong>WhatsApp Flows</strong><br>
      <img alt="WhatsApp Flows" src=".github/assets/readme/feature-whatsapp-flows.png" width="420">
    </td>
    <td width="50%" align="center" valign="top">
      <strong>Unified CRM Inbox</strong><br>
      <img alt="WhatsApp CRM Inbox" src=".github/assets/readme/feature-whatsapp-crm-inbox.png" width="420">
    </td>
  </tr>
  <tr>
    <td width="50%" align="center" valign="top">
      <strong>Facebook AI Comments</strong><br>
      <img alt="Facebook AI Comments" src=".github/assets/readme/feature-facebook-ai-comments.png" width="420">
    </td>
    <td width="50%" align="center" valign="top">
      <strong>Zalo AI Chatbot</strong><br>
      <img alt="Zalo AI Chatbot" src=".github/assets/readme/feature-zalo-ai-chatbot.png" width="420">
    </td>
  </tr>
  <tr>
    <td width="50%" align="center" valign="top">
      <strong>Bulk Scheduler</strong><br>
      <img alt="Facebook Bulk Scheduler" src=".github/assets/readme/feature-facebook-bulk-scheduler.png" width="420">
    </td>
    <td width="50%" align="center" valign="top">
      <strong>Zalo ZNS Marketing</strong><br>
      <img alt="Zalo ZNS Marketing" src=".github/assets/readme/feature-zalo-zns-marketing.png" width="420">
    </td>
  </tr>
</table>

## Tech Stack

- Node.js 24
- TypeScript 5
- pnpm 10 workspaces
- Turborepo
- Next.js 16 and React 19 for `apps/builder`
- PartyKit / PartySocket for realtime messaging
- Drizzle ORM with PostgreSQL and pgvector
- Redis and BullMQ for queues and worker coordination
- RustFS / S3-compatible storage for uploaded assets
- ClickHouse for analytics
- Docker Compose for local infrastructure

## Quick Start

To have the project up and running, please follow the [Quick Start Guide](https://docs.chatbotx.io/quickstart).

## Project Structure

```text
.
|-- apps/
|   |-- builder/       # Next.js web app and product builder
|   |-- worker/        # background workers for chat, AI, triggers, webhooks, analytics, sequences
|   |-- partysocket/   # realtime server
|   |-- cli/           # ChatbotX command line client
|   `-- mcp-server/    # MCP server backed by public APIs
|-- integrations/
|   |-- whatsapp/
|   |-- messenger/
|   |-- instagram/
|   |-- telegram/
|   |-- zalo/
|   |-- webchat/
|   |-- smtp/
|   |-- openai/
|   `-- google-sheets/
|-- packages/
|   |-- database/
|   |-- ai/
|   |-- analytics/
|   |-- public-apis/
|   |-- sdk/
|   |-- scheduler/
|   |-- sequence-scheduler/
|   |-- ui/
|   `-- worker-config/
|-- docker-compose.yml
|-- pnpm-workspace.yaml
`-- turbo.json
```

## Development Commands

```bash
pnpm dev              # run turbo dev
pnpm build            # build all packages/apps through Turborepo
pnpm lint             # run Ultracite lint
pnpm fix              # run Ultracite fix
pnpm check:circular   # check circular dependencies
pnpm check:unused     # check unused files and dependencies
```

Useful package-level commands:

```bash
pnpm --filter builder dev
pnpm --filter worker dev
pnpm --filter partysocket dev
pnpm --filter chatbotx-cli dev:cli
pnpm --filter chatbotx-mcp-server dev:mcp
pnpm --filter @chatbotx.io/database db:studio
```

## Services

The default Docker Compose stack includes:

- PostgreSQL with pgvector on `5432`
- Redis on `6379`
- RedisInsight on `5540`
- RustFS object storage on `9000` and console on `9001`
- MailHog SMTP on `1025` and UI on `8025`
- Adminer on `8080`
- ClickHouse through the included ClickHouse compose file

## License

See `LICENSE` in `ChatbotXIO/ChatbotX`. The repository includes AGPLv3-licensed code and commercial-license portions as defined in the license file.

## Star History

<p align="center">
  <a href="https://www.star-history.com/#ChatbotXIO/ChatbotX&Date">
    <img alt="Star History Chart" src=".github/assets/readme/star-history-chart.svg">
  </a>
</p>

<p align="center">
  <a href="https://www.medusajs.com">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://user-images.githubusercontent.com/59018053/229103275-b5e482bb-4601-46e6-8142-244f531cebdb.svg">
    <source media="(prefers-color-scheme: light)" srcset="https://user-images.githubusercontent.com/59018053/229103726-e5b529a3-9b3f-4970-8a1f-c6af37f087bf.svg">
    <img alt="Medusa logo" src="https://user-images.githubusercontent.com/59018053/229103726-e5b529a3-9b3f-4970-8a1f-c6af37f087bf.svg">
    </picture>
  </a>
</p>
<h1 align="center">
  Medusa
</h1>

<h4 align="center">
  <a href="https://docs.medusajs.com">Documentation</a> |
  <a href="https://www.medusajs.com">Website</a>
</h4>

<p align="center">
  Building blocks for digital commerce
</p>
<p align="center">
  <a href="https://github.com/medusajs/medusa/blob/master/CONTRIBUTING.md">
    <img src="https://img.shields.io/badge/PRs-welcome-brightgreen.svg?style=flat" alt="PRs welcome!" />
  </a>
    <a href="https://www.producthunt.com/posts/medusa"><img src="https://img.shields.io/badge/Product%20Hunt-%231%20Product%20of%20the%20Day-%23DA552E" alt="Product Hunt"></a>
  <a href="https://discord.gg/xpCwq3Kfn8">
    <img src="https://img.shields.io/badge/chat-on%20discord-7289DA.svg" alt="Discord Chat" />
  </a>
  <a href="https://twitter.com/intent/follow?screen_name=medusajs">
    <img src="https://img.shields.io/twitter/follow/medusajs.svg?label=Follow%20@medusajs" alt="Follow @medusajs" />
  </a>
</p>

## Compatibility

This starter is compatible with versions >= 2 of `@medusajs/medusa`. 

## Getting Started

Visit the [Quickstart Guide](https://docs.medusajs.com/learn/installation) to set up a server.

Visit the [Docs](https://docs.medusajs.com/learn/installation#get-started) to learn more about our system requirements.

## What is Medusa

Medusa is a set of commerce modules and tools that allow you to build rich, reliable, and performant commerce applications without reinventing core commerce logic. The modules can be customized and used to build advanced ecommerce stores, marketplaces, or any product that needs foundational commerce primitives. All modules are open-source and freely available on npm.

Learn more about [Medusa’s architecture](https://docs.medusajs.com/learn/introduction/architecture) and [commerce modules](https://docs.medusajs.com/learn/fundamentals/modules/commerce-modules) in the Docs.

## Build with AI Agents

### Claude Code Plugin

If you use AI agents like Claude Code, check out the [medusa-dev Claude Code plugin](https://github.com/medusajs/medusa-claude-plugins).

### Other Agents

If you use AI agents other than Claude Code, copy the [skills directory](https://github.com/medusajs/medusa-claude-plugins/tree/main/plugins/medusa-dev/skills) into your agent's relevant `skills` directory.

### MCP Server

You can also add the MCP server `https://docs.medusajs.com/mcp` to your AI agents to answer questions related to Medusa. The `medusa-dev` Claude Code plugin includes this MCP server by default.

## Community & Contributions

The community and core team are available in [GitHub Discussions](https://github.com/medusajs/medusa/discussions), where you can ask for support, discuss roadmap, and share ideas.

Join our [Discord server](https://discord.com/invite/medusajs) to meet other community members.

## Other channels

- [GitHub Issues](https://github.com/medusajs/medusa/issues)
- [Twitter](https://twitter.com/medusajs)
- [LinkedIn](https://www.linkedin.com/company/medusajs)
- [Medusa Blog](https://medusajs.com/blog/)

## Custom Platform OAuth + ChainUp payment

This project includes:

- Custom auth endpoint: `POST/GET /auth/platform-login`
- Custom payment webhook: `POST /hooks/payment/chainup`
- ChainUp payment provider id: `pp_chainup_platform`
- Store refund request endpoint: `POST /store/refund-requests`
- Admin refund review endpoint: `POST /admin/refund-requests/:id`
- Admin coin grant endpoint: `POST /admin/chainup/coin-grants`

### Required environment variables

Set these in `.env` (see `.env.template`):

- `PLATFORM_API_URL`
- `PLATFORM_APP_KEY`
- `PLATFORM_SECRET_KEY`
- `PLATFORM_OAUTH_CALLBACK_URL` (storefront callback URL, for example `http://localhost:8000/auth/callback`)
- `CHAINUP_PAY_COIN_SYMBOL`
- `CHAINUP_GRANT_DEFAULT_COIN_SYMBOL` (optional, fallback to `CHAINUP_PAY_COIN_SYMBOL`)
- `CHAINUP_PAYMENT_RETURN_PAGE`
- `CHAINUP_PAYMENT_NOTIFY_PAGE` (for example `http://localhost:9000/hooks/payment/chainup`)
- `CHAINUP_ORDER_SCENE_TYPE` (optional)

### Backend tests

```bash
npm run test:unit
npm run test:integration:http
```

> `integration:http` uses `@medusajs/test-utils`. By default, `jest.config.js` derives `DB_HOST/DB_PORT/DB_USERNAME/DB_PASSWORD` from `DATABASE_URL`, so tests use the same configured PostgreSQL host (you can still override `DB_*` explicitly if needed).

### Quick API checks

Request OAuth redirect URL:

```bash
curl -X POST http://localhost:9000/auth/platform-login \\
  -H "Content-Type: application/json" \\
  -d '{\"callback_url\":\"http://localhost:8000/auth/callback\"}'
```

Token-based login:

```bash
curl -X POST http://localhost:9000/auth/platform-login \\
  -H "Content-Type: application/json" \\
  -d '{\"token\":\"<exchange-token>\"}'
```

Webhook endpoint:

```bash
curl -X POST http://localhost:9000/hooks/payment/chainup \\
  -H "Content-Type: application/json" \\
  -d '{\"sign\":\"test-sign\",\"outOrderId\":\"payses_123\",\"orderStatus\":\"3\",\"payAmount\":\"12.5\"}'
```

Store refund request (customer token required):

```bash
curl -X POST http://localhost:9000/store/refund-requests \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer <customer-jwt>" \\
  -d '{
    "order_id": "order_123",
    "payment_id": "pay_123",
    "amount": "5.5",
    "reason": "return",
    "note": "Request partial refund",
    "idempotency_key": "refund_req_123"
  }'
```

Admin review refund request (approve or reject):

```bash
curl -X POST http://localhost:9000/admin/refund-requests/refreq_123 \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer <admin-jwt>" \\
  -d '{
    "action": "approve",
    "amount": "5.5",
    "note": "Approved by support"
  }'
```

Admin coin grant:

```bash
curl -X POST http://localhost:9000/admin/chainup/coin-grants \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer <admin-jwt>" \\
  -d '{
    "app_order_id": "grant_20260312_001",
    "amount": "3",
    "pay_coin_symbol": "USDT",
    "user_id": "uid_777",
    "metadata": {
      "source": "support_adjustment"
    }
  }'
```

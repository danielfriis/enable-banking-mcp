# Enable Banking MCP Server

A personal remote MCP (Model Context Protocol) server that connects your bank accounts to AI assistants like Claude, ChatGPT, and Cursor via the [Enable Banking](https://enablebanking.com/) PSD2 AIS API.

[![Deploy to Cloudflare Workers](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/nowadays-tech/enable-banking-mcp)

## Features

- **5 MCP Tools**: `list_accounts`, `get_balances`, `get_transactions`, `search_transactions`, `summarize_spending`
- **32 European Countries**: Supports banks across the EU/EEA via Enable Banking
- **OAuth + Bearer Token Auth**: OAuth for Claude.ai/ChatGPT, Bearer token for Cursor/CLI tools
- **Beautiful Setup UI**: Connect your bank through a friendly web interface
- **One-Click Deploy**: Deploy to your own Cloudflare account in minutes
- **Privacy-First**: Your data stays in your Cloudflare account, no third-party storage

## Quick Start

### 1. Create an Enable Banking Account

1. Go to [Enable Banking Control Panel](https://enablebanking.com/cp/)
2. Create a free account (restricted production allows connecting your own accounts)
3. Create a new application:
   - Name: `My Banking MCP` (or any name)
   - Type: `Personal` (for your own accounts)
   - Redirect URL: `https://YOUR-WORKER-NAME.YOUR-SUBDOMAIN.workers.dev/callback`
     (You'll update this after deploying)
4. Generate or upload an RSA private key (2048-bit or 4096-bit)
5. Note your **Application ID** and download your **private key**

### 2. Deploy to Cloudflare

Click the deploy button above, or deploy manually:

```bash
# Clone this repository
git clone https://github.com/nowadays-tech/enable-banking-mcp.git
cd enable-banking-mcp

# Install dependencies
npm install

# Create KV namespaces and note the IDs
npx wrangler kv namespace create BANKING_KV
npx wrangler kv namespace create OAUTH_KV
# Copy the IDs from the output and update wrangler.jsonc

# Set secrets
npx wrangler secret put ENABLE_BANKING_APP_ID
# Enter your Enable Banking application ID

npx wrangler secret put ENABLE_BANKING_PRIVATE_KEY
# Paste your RSA private key (including BEGIN/END lines)

npx wrangler secret put AUTH_SECRET
# Enter a strong password for authentication

# Deploy
npm run deploy
```

### 3. Update Enable Banking Redirect URL

After deploying, update your Enable Banking application's redirect URL to:
```
https://YOUR-WORKER-NAME.YOUR-SUBDOMAIN.workers.dev/callback
```

### 4. Connect Your Bank

1. Visit `https://YOUR-WORKER-NAME.YOUR-SUBDOMAIN.workers.dev/`
2. Log in with your `AUTH_SECRET` password
3. Select your country and bank
4. Complete the bank's authentication flow
5. Your accounts are now connected!

### 5. Add to Your AI Assistant

#### Claude.ai (via OAuth)

1. Go to Claude Settings → Integrations → Add Custom MCP Server
2. Enter the server URL: `https://YOUR-WORKER.workers.dev/mcp`
3. Claude will handle OAuth automatically - you'll be prompted to authorize
4. Enter your `AUTH_SECRET` password when asked to consent

#### ChatGPT (via OAuth)

1. Create or edit a Custom GPT
2. Add an Action:
   - Import OpenAPI spec from: `https://YOUR-WORKER/.well-known/mcp`
   - Authentication: OAuth 2.0
   - Authorization URL: `https://YOUR-WORKER/authorize`
   - Token URL: `https://YOUR-WORKER/token`
   - Client Registration: `https://YOUR-WORKER/register` (for dynamic registration)

#### Cursor / Claude Code (via Bearer Token)

Add to your MCP settings (Settings → Features → MCP Servers):

```json
{
  "mcpServers": {
    "banking": {
      "url": "https://YOUR-WORKER.workers.dev/mcp",
      "headers": {
        "Authorization": "Bearer YOUR_AUTH_SECRET"
      }
    }
  }
}
```

## MCP Tools

### `list_accounts`
Lists all connected bank accounts with names, IBANs, currencies, and account types.

### `get_balances`
Gets the current balance for a specific account.
- `account_id` (required): The account ID from `list_accounts`

### `get_transactions`
Retrieves transactions within a date range.
- `account_id` (required): The account ID
- `date_from` (optional): Start date (YYYY-MM-DD), defaults to 30 days ago
- `date_to` (optional): End date (YYYY-MM-DD), defaults to today
- `continuation_key` (optional): For paginating large result sets

### `search_transactions`
Search transactions by text in counterparty name or description.
- `account_id` (required): The account ID
- `query` (required): Search text (case-insensitive)
- `date_from` (optional): Start date, defaults to 90 days ago
- `date_to` (optional): End date, defaults to today
- `limit` (optional): Maximum results, defaults to 50

### `summarize_spending`
Summarizes spending by category for a month.
- `account_id` (required): The account ID
- `month` (optional): Month in YYYY-MM format, or "last3" for last 3 months

## Configuration

### Environment Variables (Secrets)

| Secret | Description |
|--------|-------------|
| `ENABLE_BANKING_APP_ID` | Your Enable Banking application ID |
| `ENABLE_BANKING_PRIVATE_KEY` | RSA private key (PEM format) for JWT signing |
| `AUTH_SECRET` | Password for OAuth consent, web UI, and bearer token auth |

### KV Namespaces

| Binding | Description |
|---------|-------------|
| `BANKING_KV` | Stores bank sessions and consent data |
| `OAUTH_KV` | Stores OAuth tokens and client registrations |

## Authentication

This server supports two authentication methods:

### OAuth 2.0 (for Claude.ai, ChatGPT)
- Supports dynamic client registration (MCP spec compliant)
- Single-owner consent screen where you enter your `AUTH_SECRET`
- Endpoints: `/authorize`, `/token`, `/register`

### Bearer Token (for Cursor, CLI tools)
- Simple: use your `AUTH_SECRET` as the bearer token
- Header: `Authorization: Bearer YOUR_AUTH_SECRET`

## Limitations & Notes

### Consent Duration
- Bank consent typically lasts **90-180 days** depending on the bank
- You'll need to reconnect when consent expires
- The setup page shows your consent expiry date

### Rate Limits
- Enable Banking has rate limits on API calls
- Avoid making too many rapid requests
- The MCP server handles pagination automatically

### Sandbox vs Production
- **Sandbox**: Test with mock data (free, unlimited)
- **Restricted Production**: Connect your own real accounts (free, limited to your accounts)
- **Full Production**: Requires Enable Banking approval for commercial use

### Security & Privacy

- **Your data stays private**: All data is stored in your own Cloudflare KV namespace
- **OAuth + Bearer auth**: Flexible authentication for different clients
- **No logging**: Transaction data is not logged or stored beyond the session
- **JWT signing**: All Enable Banking API calls are authenticated with your private key
- **HTTPS only**: All connections use TLS encryption

## Development

```bash
# Install dependencies
npm install

# Generate types
npm run types

# Run locally (requires KV namespace IDs in wrangler.jsonc)
npm run dev

# Run tests
npm test

# Type check
npm run typecheck

# Deploy
npm run deploy
```

### Project Structure

```
├── src/
│   ├── index.ts           # Main worker entry point with OAuth provider
│   ├── types.ts           # TypeScript type definitions
│   ├── enable-banking/
│   │   ├── client.ts      # Enable Banking API client
│   │   └── jwt.ts         # JWT signing utilities
│   ├── mcp/
│   │   └── server.ts      # MCP server with banking tools
│   └── ui/
│       └── pages.ts       # HTML pages for setup UI and OAuth consent
├── test/
│   ├── jwt.test.ts        # JWT signing tests
│   └── tools.test.ts      # Tool handler tests
├── wrangler.jsonc         # Cloudflare Workers configuration
└── package.json
```

## Troubleshooting

### "Invalid or missing bearer token"
Ensure you're sending the `Authorization: Bearer YOUR_AUTH_SECRET` header with MCP requests.

### OAuth authorization fails
Check that:
1. Your `AUTH_SECRET` is set correctly
2. The MCP client supports OAuth 2.0 with dynamic client registration
3. You're entering the correct password on the consent screen

### "Bank consent has expired"
Visit the setup page to reconnect your bank account. Consent typically lasts 90-180 days.

### "Failed to start authorization"
Check that:
1. Your Enable Banking app ID and private key are correct
2. The redirect URL in Enable Banking matches your worker URL
3. Your private key is in PEM format with BEGIN/END lines

### "No bank account connected"
Visit `/setup` to connect a bank account first.

## License

MIT License - see [LICENSE](LICENSE) for details.

## Credits

- [Enable Banking](https://enablebanking.com/) - PSD2 AIS API
- [Cloudflare Workers](https://workers.cloudflare.com/) - Serverless platform
- [MCP Protocol](https://modelcontextprotocol.io/) - Model Context Protocol specification
- [@cloudflare/workers-oauth-provider](https://github.com/cloudflare/workers-oauth-provider) - OAuth provider library

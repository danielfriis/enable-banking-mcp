# Enable Banking MCP Server

A personal remote MCP (Model Context Protocol) server that connects your bank accounts to AI assistants like Claude, ChatGPT, and Cursor via the [Enable Banking](https://enablebanking.com/) PSD2 AIS API.

[![Deploy to Cloudflare Workers](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/YOUR_USERNAME/enable-banking-mcp)

## Features

- **5 MCP Tools**: `list_accounts`, `get_balances`, `get_transactions`, `search_transactions`, `summarize_spending`
- **32 European Countries**: Supports banks across the EU/EEA via Enable Banking
- **Simple Authentication**: Bearer token authentication (your secret password)
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
git clone https://github.com/YOUR_USERNAME/enable-banking-mcp.git
cd enable-banking-mcp

# Install dependencies
npm install

# Create KV namespace
npx wrangler kv namespace create BANKING_KV

# Update wrangler.jsonc with the KV namespace ID from the output

# Set secrets
npx wrangler secret put ENABLE_BANKING_APP_ID
# Enter your Enable Banking application ID

npx wrangler secret put ENABLE_BANKING_PRIVATE_KEY
# Paste your RSA private key (including BEGIN/END lines)

npx wrangler secret put AUTH_SECRET
# Enter a strong password for MCP authentication

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

#### Claude.ai

1. Go to Claude Settings → MCP Servers
2. Add a custom server:
   - URL: `https://YOUR-WORKER-NAME.YOUR-SUBDOMAIN.workers.dev/mcp`
   - Authentication: Bearer Token
   - Token: Your `AUTH_SECRET`

#### Cursor

Add to your MCP settings:
```json
{
  "mcpServers": {
    "banking": {
      "url": "https://YOUR-WORKER-NAME.YOUR-SUBDOMAIN.workers.dev/mcp",
      "headers": {
        "Authorization": "Bearer YOUR_AUTH_SECRET"
      }
    }
  }
}
```

#### ChatGPT (Custom GPTs)

1. Create or edit a Custom GPT
2. Add an Action with:
   - Schema: Import from `https://YOUR-WORKER/mcp`
   - Authentication: Bearer Token with your `AUTH_SECRET`

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
| `AUTH_SECRET` | Password for MCP and web UI authentication |

### wrangler.jsonc

The configuration auto-provisions a KV namespace for storing bank session data:

```jsonc
{
  "name": "enable-banking-mcp",
  "main": "src/index.ts",
  "compatibility_date": "2026-10-12",
  "compatibility_flags": ["nodejs_compat"],
  "kv_namespaces": [
    {
      "binding": "BANKING_KV",
      "id": "YOUR_KV_NAMESPACE_ID"
    }
  ]
}
```

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
- **Bearer token auth**: The `AUTH_SECRET` protects both the web UI and MCP endpoint
- **No logging**: Transaction data is not logged or stored beyond the session
- **JWT signing**: All Enable Banking API calls are authenticated with your private key
- **HTTPS only**: All connections use TLS encryption

## Development

```bash
# Install dependencies
npm install

# Generate types
npm run types

# Run locally
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
│   ├── index.ts           # Main worker entry point
│   ├── types.ts           # TypeScript type definitions
│   ├── enable-banking/
│   │   ├── client.ts      # Enable Banking API client
│   │   └── jwt.ts         # JWT signing utilities
│   ├── mcp/
│   │   └── server.ts      # MCP server with banking tools
│   └── ui/
│       └── pages.ts       # HTML pages for setup UI
├── test/
│   ├── jwt.test.ts        # JWT signing tests
│   └── tools.test.ts      # Tool handler tests
├── wrangler.jsonc         # Cloudflare Workers configuration
└── package.json
```

## Troubleshooting

### "Invalid or missing bearer token"
Ensure you're sending the `Authorization: Bearer YOUR_AUTH_SECRET` header with MCP requests.

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

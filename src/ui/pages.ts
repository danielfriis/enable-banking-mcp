import type { BankSession, ASPSP } from "../types";

const baseStyles = `
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    min-height: 100vh;
    padding: 2rem;
    color: #1a202c;
  }
  .container {
    max-width: 600px;
    margin: 0 auto;
    background: white;
    border-radius: 16px;
    box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
    padding: 2rem;
  }
  h1 { font-size: 1.875rem; font-weight: 700; margin-bottom: 0.5rem; color: #1a202c; }
  h2 { font-size: 1.25rem; font-weight: 600; margin-bottom: 1rem; color: #4a5568; }
  p { color: #718096; margin-bottom: 1rem; line-height: 1.6; }
  .subtitle { font-size: 1rem; color: #718096; margin-bottom: 2rem; }
  label { display: block; font-weight: 500; margin-bottom: 0.5rem; color: #4a5568; }
  select, input {
    width: 100%;
    padding: 0.75rem 1rem;
    border: 2px solid #e2e8f0;
    border-radius: 8px;
    font-size: 1rem;
    margin-bottom: 1rem;
    transition: border-color 0.2s;
  }
  select:focus, input:focus {
    outline: none;
    border-color: #667eea;
  }
  button {
    width: 100%;
    padding: 0.875rem 1.5rem;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    border: none;
    border-radius: 8px;
    font-size: 1rem;
    font-weight: 600;
    cursor: pointer;
    transition: transform 0.2s, box-shadow 0.2s;
  }
  button:hover { transform: translateY(-2px); box-shadow: 0 10px 20px -10px rgba(102, 126, 234, 0.5); }
  button:disabled { opacity: 0.6; cursor: not-allowed; transform: none; }
  .btn-secondary {
    background: #e2e8f0;
    color: #4a5568;
  }
  .btn-secondary:hover { box-shadow: 0 10px 20px -10px rgba(0, 0, 0, 0.2); }
  .btn-danger {
    background: linear-gradient(135deg, #f56565 0%, #c53030 100%);
  }
  .card {
    background: #f7fafc;
    border-radius: 12px;
    padding: 1.5rem;
    margin-bottom: 1rem;
    border: 1px solid #e2e8f0;
  }
  .card h3 { font-size: 1.125rem; color: #2d3748; margin-bottom: 0.5rem; }
  .badge {
    display: inline-block;
    padding: 0.25rem 0.75rem;
    border-radius: 9999px;
    font-size: 0.75rem;
    font-weight: 600;
    margin-left: 0.5rem;
  }
  .badge-success { background: #c6f6d5; color: #276749; }
  .badge-warning { background: #fefcbf; color: #975a16; }
  .badge-error { background: #fed7d7; color: #c53030; }
  .info-row { display: flex; justify-content: space-between; padding: 0.5rem 0; border-bottom: 1px solid #e2e8f0; }
  .info-row:last-child { border-bottom: none; }
  .info-label { color: #718096; }
  .info-value { font-weight: 500; color: #2d3748; }
  .account-list { margin-top: 1rem; }
  .account-item {
    background: white;
    border-radius: 8px;
    padding: 1rem;
    margin-bottom: 0.75rem;
    border: 1px solid #e2e8f0;
  }
  .account-name { font-weight: 600; color: #2d3748; }
  .account-iban { font-family: monospace; color: #718096; font-size: 0.875rem; }
  .error { color: #c53030; background: #fed7d7; padding: 1rem; border-radius: 8px; margin-bottom: 1rem; }
  .success { color: #276749; background: #c6f6d5; padding: 1rem; border-radius: 8px; margin-bottom: 1rem; }
  .loading { text-align: center; padding: 2rem; color: #718096; }
  .mcp-url {
    background: #2d3748;
    color: #a0aec0;
    padding: 1rem;
    border-radius: 8px;
    font-family: monospace;
    font-size: 0.875rem;
    word-break: break-all;
    margin: 1rem 0;
  }
  .mcp-url code { color: #68d391; }
  .divider { border-top: 1px solid #e2e8f0; margin: 1.5rem 0; }
  .banks-grid { display: grid; grid-template-columns: 1fr; gap: 0.75rem; max-height: 300px; overflow-y: auto; }
  .bank-item {
    display: flex;
    align-items: center;
    padding: 0.875rem 1rem;
    border: 2px solid #e2e8f0;
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.2s;
  }
  .bank-item:hover { border-color: #667eea; background: #f7fafc; }
  .bank-item.selected { border-color: #667eea; background: #ebf4ff; }
  .bank-name { font-weight: 500; }
  .hidden { display: none; }
`;

export function renderSetupPage(countries: string[]): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Enable Banking MCP - Setup</title>
  <style>${baseStyles}</style>
</head>
<body>
  <div class="container">
    <h1>🏦 Enable Banking MCP</h1>
    <p class="subtitle">Connect your bank account to use with AI assistants</p>

    <form id="setupForm" action="/auth/start" method="POST">
      <label for="country">Select Country</label>
      <select id="country" name="country" required>
        <option value="">Choose a country...</option>
        ${countries.map((c) => `<option value="${c}">${c}</option>`).join("")}
      </select>

      <div id="bankSection" class="hidden">
        <label>Select Bank</label>
        <input type="text" id="bankSearch" placeholder="Search banks..." />
        <div id="banksList" class="banks-grid"></div>
        <input type="hidden" id="aspspId" name="aspsp_id" required />
        <input type="hidden" id="aspspName" name="aspsp_name" />
      </div>

      <div id="submitSection" class="hidden">
        <button type="submit" id="connectBtn">Connect Bank</button>
      </div>
    </form>
  </div>

  <script>
    let allBanks = [];
    const countrySelect = document.getElementById('country');
    const bankSection = document.getElementById('bankSection');
    const banksList = document.getElementById('banksList');
    const bankSearch = document.getElementById('bankSearch');
    const aspspIdInput = document.getElementById('aspspId');
    const aspspNameInput = document.getElementById('aspspName');
    const submitSection = document.getElementById('submitSection');

    countrySelect.addEventListener('change', async () => {
      const country = countrySelect.value;
      if (!country) {
        bankSection.classList.add('hidden');
        return;
      }

      banksList.innerHTML = '<div class="loading">Loading banks...</div>';
      bankSection.classList.remove('hidden');
      submitSection.classList.add('hidden');

      try {
        const res = await fetch('/api/banks?country=' + encodeURIComponent(country));
        allBanks = await res.json();
        renderBanks(allBanks);
      } catch (err) {
        banksList.innerHTML = '<div class="error">Failed to load banks</div>';
      }
    });

    bankSearch.addEventListener('input', () => {
      const query = bankSearch.value.toLowerCase();
      const filtered = allBanks.filter(b => b.name.toLowerCase().includes(query));
      renderBanks(filtered);
    });

    function renderBanks(banks) {
      if (banks.length === 0) {
        banksList.innerHTML = '<div class="loading">No banks found</div>';
        return;
      }
      banksList.innerHTML = banks.map(b => 
        '<div class="bank-item" data-id="' + (b.aspsp_id || b.name) + '" data-name="' + b.name + '">' +
          '<span class="bank-name">' + b.name + (b.sandbox ? ' (Sandbox)' : '') + '</span>' +
        '</div>'
      ).join('');

      document.querySelectorAll('.bank-item').forEach(item => {
        item.addEventListener('click', () => {
          document.querySelectorAll('.bank-item').forEach(i => i.classList.remove('selected'));
          item.classList.add('selected');
          aspspIdInput.value = item.dataset.id;
          aspspNameInput.value = item.dataset.name;
          submitSection.classList.remove('hidden');
        });
      });
    }
  </script>
</body>
</html>`;
}

export function renderConnectedPage(
  session: BankSession,
  baseUrl: string
): string {
  const expiryDate = new Date(session.consentValidUntil);
  const now = new Date();
  const daysUntilExpiry = Math.ceil(
    (expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
  );
  const isExpired = daysUntilExpiry <= 0;
  const isExpiringSoon = daysUntilExpiry > 0 && daysUntilExpiry <= 7;

  const statusBadge = isExpired
    ? '<span class="badge badge-error">Expired</span>'
    : isExpiringSoon
      ? '<span class="badge badge-warning">Expiring Soon</span>'
      : '<span class="badge badge-success">Active</span>';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Enable Banking MCP - Connected</title>
  <style>${baseStyles}</style>
</head>
<body>
  <div class="container">
    <h1>🏦 Bank Connected ${statusBadge}</h1>
    <p class="subtitle">Your bank account is connected and ready to use</p>

    <div class="card">
      <h3>${session.aspspName}</h3>
      <div class="info-row">
        <span class="info-label">Country</span>
        <span class="info-value">${session.aspspCountry}</span>
      </div>
      <div class="info-row">
        <span class="info-label">Connected Since</span>
        <span class="info-value">${new Date(session.createdAt).toLocaleDateString()}</span>
      </div>
      <div class="info-row">
        <span class="info-label">Consent Expires</span>
        <span class="info-value">${expiryDate.toLocaleDateString()} ${isExpired ? "(Expired)" : `(${daysUntilExpiry} days)`}</span>
      </div>
    </div>

    <h2>Connected Accounts</h2>
    <div class="account-list">
      ${session.accounts
        .map(
          (acc) => `
        <div class="account-item">
          <div class="account-name">${acc.name || "Account"}</div>
          ${acc.iban ? `<div class="account-iban">${acc.iban}</div>` : ""}
          <div style="color: #718096; font-size: 0.875rem; margin-top: 0.25rem;">
            ${acc.currency || ""} ${acc.accountType ? `• ${acc.accountType}` : ""}
          </div>
        </div>
      `
        )
        .join("")}
    </div>

    <div class="divider"></div>

    <h2>MCP Server URL</h2>
    <p>Add this URL to your AI assistant (Claude, ChatGPT, Cursor, etc.):</p>
    <div class="mcp-url">
      <code>${baseUrl}/mcp</code>
    </div>
    <p style="font-size: 0.875rem;">
      Available tools: <strong>list_accounts</strong>, <strong>get_balances</strong>, 
      <strong>get_transactions</strong>, <strong>search_transactions</strong>, 
      <strong>summarize_spending</strong>
    </p>

    <div class="divider"></div>

    <div style="display: flex; gap: 1rem;">
      <form action="/auth/start" method="GET" style="flex: 1;">
        <button type="submit" class="btn-secondary">
          ${isExpired ? "Reconnect Bank" : "Connect Another Bank"}
        </button>
      </form>
      <form action="/disconnect" method="POST" style="flex: 1;">
        <button type="submit" class="btn-danger">Disconnect</button>
      </form>
    </div>
  </div>
</body>
</html>`;
}

export function renderCallbackSuccessPage(session: BankSession): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Enable Banking MCP - Success</title>
  <style>${baseStyles}</style>
</head>
<body>
  <div class="container">
    <div class="success">
      <h2 style="color: #276749; margin-bottom: 0.5rem;">✓ Bank Connected Successfully!</h2>
      <p style="margin: 0; color: #276749;">Your ${session.aspspName} account is now linked.</p>
    </div>

    <p>Found ${session.accounts.length} account(s). You can now use the MCP tools with your AI assistant.</p>

    <a href="/setup" style="display: block; text-decoration: none;">
      <button>View Connected Accounts</button>
    </a>
  </div>
</body>
</html>`;
}

export function renderCallbackErrorPage(error: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Enable Banking MCP - Error</title>
  <style>${baseStyles}</style>
</head>
<body>
  <div class="container">
    <div class="error">
      <h2 style="margin-bottom: 0.5rem;">Connection Failed</h2>
      <p style="margin: 0;">${error}</p>
    </div>

    <p>Please try connecting your bank again. If the problem persists, check that your Enable Banking credentials are configured correctly.</p>

    <a href="/setup" style="display: block; text-decoration: none;">
      <button>Try Again</button>
    </a>
  </div>
</body>
</html>`;
}

export function renderLoginPage(error?: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Enable Banking MCP - Login</title>
  <style>${baseStyles}</style>
</head>
<body>
  <div class="container">
    <h1>🔐 Login Required</h1>
    <p class="subtitle">Enter your password to access the banking MCP server</p>

    ${error ? `<div class="error">${error}</div>` : ""}

    <form method="POST">
      <label for="password">Password</label>
      <input type="password" id="password" name="password" required autofocus />
      <button type="submit">Login</button>
    </form>

    <p style="font-size: 0.875rem; margin-top: 1rem; text-align: center;">
      This is your personal banking MCP server. The password is set via the AUTH_SECRET environment variable.
    </p>
  </div>
</body>
</html>`;
}

export function renderDisconnectedPage(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Enable Banking MCP - Disconnected</title>
  <style>${baseStyles}</style>
</head>
<body>
  <div class="container">
    <div class="success">
      <h2 style="color: #276749; margin-bottom: 0.5rem;">Bank Disconnected</h2>
      <p style="margin: 0; color: #276749;">Your bank account has been disconnected.</p>
    </div>

    <a href="/setup" style="display: block; text-decoration: none;">
      <button>Connect a Bank</button>
    </a>
  </div>
</body>
</html>`;
}

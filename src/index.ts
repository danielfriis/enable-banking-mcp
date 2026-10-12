import { createMcpHandler } from "agents/mcp/server";
import type { Env, BankSession } from "./types";
import { createBankingMcpServer } from "./mcp/server";
import {
  EnableBankingClient,
  getStoredSession,
  storeSession,
  deleteStoredSession,
  storePendingAuth,
  getPendingAuth,
  deletePendingAuth,
} from "./enable-banking/client";
import {
  renderSetupPage,
  renderConnectedPage,
  renderCallbackSuccessPage,
  renderCallbackErrorPage,
  renderLoginPage,
  renderDisconnectedPage,
} from "./ui/pages";

const COUNTRIES = [
  "AT", "BE", "BG", "HR", "CY", "CZ", "DK", "EE", "FI", "FR",
  "DE", "GR", "HU", "IS", "IE", "IT", "LV", "LI", "LT", "LU",
  "MT", "NL", "NO", "PL", "PT", "RO", "SK", "SI", "ES", "SE",
  "GB", "CH",
];

function getBaseUrl(request: Request): string {
  const url = new URL(request.url);
  return `${url.protocol}//${url.host}`;
}

function htmlResponse(html: string, status = 200): Response {
  return new Response(html, {
    status,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const encoder = new TextEncoder();

async function constantTimeCompare(a: string, b: string): Promise<boolean> {
  const aBytes = encoder.encode(a);
  const bBytes = encoder.encode(b);

  if (aBytes.length !== bBytes.length) {
    const dummy = encoder.encode("x".repeat(Math.max(aBytes.length, bBytes.length)));
    await crypto.subtle.timingSafeEqual(dummy, dummy);
    return false;
  }

  return crypto.subtle.timingSafeEqual(aBytes, bBytes);
}

async function validateBearerToken(request: Request, env: Env): Promise<boolean> {
  const authHeader = request.headers.get("Authorization");
  if (!authHeader) return false;

  const [scheme, token] = authHeader.split(" ");
  if (scheme.toLowerCase() !== "bearer" || !token) return false;

  return await constantTimeCompare(token, env.AUTH_SECRET);
}

async function validateSessionAuth(request: Request, env: Env): Promise<boolean> {
  const cookie = request.headers.get("Cookie") || "";
  const match = cookie.match(/session=([^;]+)/);
  if (!match) return false;

  const sessionToken = match[1];
  const data = await env.BANKING_KV.get(`web_session:${sessionToken}`, "json");
  return data !== null;
}

async function createSessionCookie(env: Env): Promise<string> {
  const sessionToken = crypto.randomUUID();
  await env.BANKING_KV.put(
    `web_session:${sessionToken}`,
    JSON.stringify({ createdAt: Date.now() }),
    { expirationTtl: 86400 * 7 }
  );
  return `session=${sessionToken}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${86400 * 7}`;
}

async function handleSetupRoutes(
  request: Request,
  env: Env,
  ctx: ExecutionContext
): Promise<Response | null> {
  const url = new URL(request.url);
  const path = url.pathname;

  if (path === "/login") {
    if (request.method === "GET") {
      return htmlResponse(renderLoginPage());
    }

    if (request.method === "POST") {
      const formData = await request.formData();
      const password = formData.get("password")?.toString() || "";

      const isValid = await constantTimeCompare(password, env.AUTH_SECRET);
      if (!isValid) {
        return htmlResponse(renderLoginPage("Invalid password. Please try again."), 401);
      }

      const sessionCookie = await createSessionCookie(env);
      return new Response(null, {
        status: 302,
        headers: {
          Location: "/setup",
          "Set-Cookie": sessionCookie,
        },
      });
    }
  }

  const isAuthenticated = await validateSessionAuth(request, env);

  if (path === "/" || path === "/setup") {
    if (!isAuthenticated) {
      return Response.redirect(`${getBaseUrl(request)}/login`, 302);
    }

    const session = await getStoredSession(env.BANKING_KV);
    if (session) {
      return htmlResponse(renderConnectedPage(session, getBaseUrl(request)));
    }
    return htmlResponse(renderSetupPage(COUNTRIES));
  }

  if (path === "/api/banks") {
    if (!isAuthenticated) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    const country = url.searchParams.get("country");
    if (!country) {
      return jsonResponse({ error: "country parameter required" }, 400);
    }

    try {
      const client = new EnableBankingClient(env);
      const banks = await client.getASPSPs(country);
      return jsonResponse(banks);
    } catch (error) {
      console.error("Failed to fetch banks:", error);
      return jsonResponse({ error: "Failed to fetch banks" }, 500);
    }
  }

  if (path === "/auth/start") {
    if (!isAuthenticated) {
      return Response.redirect(`${getBaseUrl(request)}/login`, 302);
    }

    if (request.method === "GET") {
      return htmlResponse(renderSetupPage(COUNTRIES));
    }

    if (request.method === "POST") {
      const formData = await request.formData();
      const aspspId = formData.get("aspsp_id")?.toString();
      const aspspName = formData.get("aspsp_name")?.toString() || aspspId || "";

      if (!aspspId) {
        return htmlResponse(
          renderCallbackErrorPage("Please select a bank"),
          400
        );
      }

      const state = crypto.randomUUID();
      const redirectUrl = `${getBaseUrl(request)}/callback`;

      try {
        const client = new EnableBankingClient(env);
        const auth = await client.startAuthorization(
          aspspId,
          redirectUrl,
          "personal",
          state
        );

        await storePendingAuth(env.BANKING_KV, state, aspspId, aspspName, "");

        return Response.redirect(auth.url, 302);
      } catch (error) {
        console.error("Failed to start authorization:", error);
        return htmlResponse(
          renderCallbackErrorPage(
            `Failed to start authorization: ${error instanceof Error ? error.message : "Unknown error"}`
          ),
          500
        );
      }
    }
  }

  if (path === "/callback") {
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    const error = url.searchParams.get("error");

    if (error) {
      return htmlResponse(
        renderCallbackErrorPage(`Bank returned error: ${error}`),
        400
      );
    }

    if (!code || !state) {
      return htmlResponse(
        renderCallbackErrorPage("Missing authorization code or state"),
        400
      );
    }

    const pendingAuth = await getPendingAuth(env.BANKING_KV, state);
    if (!pendingAuth) {
      return htmlResponse(
        renderCallbackErrorPage("Invalid or expired state. Please try again."),
        400
      );
    }

    try {
      const client = new EnableBankingClient(env);
      const sessionResponse = await client.createSession(code);

      const session: BankSession = {
        sessionId: sessionResponse.session_id,
        aspspId: pendingAuth.aspspId,
        aspspName: sessionResponse.aspsp?.name || pendingAuth.aspspName,
        aspspCountry: sessionResponse.aspsp?.country || pendingAuth.aspspCountry,
        consentValidUntil: sessionResponse.access.valid_until,
        accounts: sessionResponse.accounts.map((acc) => ({
          accountId: acc.uid,
          iban: acc.account_id?.iban,
          name: acc.name,
          currency: acc.currency,
          accountType: acc.account_type,
        })),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await storeSession(env.BANKING_KV, session);
      await deletePendingAuth(env.BANKING_KV, state);

      return htmlResponse(renderCallbackSuccessPage(session));
    } catch (error) {
      console.error("Failed to create session:", error);
      return htmlResponse(
        renderCallbackErrorPage(
          `Failed to create session: ${error instanceof Error ? error.message : "Unknown error"}`
        ),
        500
      );
    }
  }

  if (path === "/disconnect" && request.method === "POST") {
    if (!isAuthenticated) {
      return Response.redirect(`${getBaseUrl(request)}/login`, 302);
    }

    const session = await getStoredSession(env.BANKING_KV);
    if (session) {
      try {
        const client = new EnableBankingClient(env);
        await client.deleteSession(session.sessionId);
      } catch (error) {
        console.error("Failed to delete session at Enable Banking:", error);
      }
      await deleteStoredSession(env.BANKING_KV);
    }
    return htmlResponse(renderDisconnectedPage());
  }

  return null;
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
          "Access-Control-Allow-Headers": "Authorization, Content-Type",
          "Access-Control-Max-Age": "86400",
        },
      });
    }

    const setupResponse = await handleSetupRoutes(request, env, ctx);
    if (setupResponse) {
      return setupResponse;
    }

    if (path === "/mcp" || path.startsWith("/mcp/")) {
      const isAuthorized = await validateBearerToken(request, env);

      if (!isAuthorized) {
        return new Response(
          JSON.stringify({
            error: "unauthorized",
            message: "Invalid or missing bearer token. Use your AUTH_SECRET as the bearer token.",
          }),
          {
            status: 401,
            headers: {
              "Content-Type": "application/json",
              "WWW-Authenticate": 'Bearer realm="enable-banking-mcp"',
            },
          }
        );
      }

      const mcpHandler = createMcpHandler(() => createBankingMcpServer(env), {
        allowedHostnames: ["*"],
        corsOptions: {
          origin: "*",
        },
      });

      return mcpHandler(request, env, ctx);
    }

    if (path === "/.well-known/mcp") {
      const baseUrl = getBaseUrl(request);
      return jsonResponse({
        name: "enable-banking-mcp",
        version: "1.0.0",
        description: "Personal MCP server for bank data via Enable Banking PSD2 AIS API",
        url: `${baseUrl}/mcp`,
        authentication: {
          type: "bearer",
          description: "Use your AUTH_SECRET as the bearer token",
        },
        tools: [
          {
            name: "list_accounts",
            description: "List all connected bank accounts",
          },
          {
            name: "get_balances",
            description: "Get the current balance for a bank account",
          },
          {
            name: "get_transactions",
            description: "Get transactions for a bank account",
          },
          {
            name: "search_transactions",
            description: "Search transactions by text",
          },
          {
            name: "summarize_spending",
            description: "Summarize spending by month and category",
          },
        ],
      });
    }

    return new Response("Not Found", { status: 404 });
  },
};

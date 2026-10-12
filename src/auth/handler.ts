import type { Env } from "../types";
import { renderLoginPage } from "../ui/pages";

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

export class AuthHandler {
  constructor(private env: Env) {}

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/authorize") {
      return this.handleAuthorize(request);
    }

    return new Response("Not Found", { status: 404 });
  }

  private async handleAuthorize(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const redirectUri = url.searchParams.get("redirect_uri");
    const state = url.searchParams.get("state");
    const clientId = url.searchParams.get("client_id");

    if (!redirectUri || !state) {
      return new Response("Missing required parameters", { status: 400 });
    }

    if (request.method === "GET") {
      return new Response(renderLoginPage(), {
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });
    }

    if (request.method === "POST") {
      const formData = await request.formData();
      const password = formData.get("password")?.toString() || "";

      const isValid = await constantTimeCompare(password, this.env.AUTH_SECRET);

      if (!isValid) {
        return new Response(renderLoginPage("Invalid password. Please try again."), {
          status: 401,
          headers: { "Content-Type": "text/html; charset=utf-8" },
        });
      }

      const code = crypto.randomUUID();
      await this.env.BANKING_KV.put(
        `auth_code:${code}`,
        JSON.stringify({
          clientId,
          redirectUri,
          createdAt: Date.now(),
        }),
        { expirationTtl: 300 }
      );

      const redirect = new URL(redirectUri);
      redirect.searchParams.set("code", code);
      redirect.searchParams.set("state", state);

      return Response.redirect(redirect.toString(), 302);
    }

    return new Response("Method not allowed", { status: 405 });
  }
}

export async function validateAuthCode(
  kv: KVNamespace,
  code: string,
  redirectUri: string
): Promise<{ clientId: string } | null> {
  const data = await kv.get(`auth_code:${code}`, "json");
  if (!data) return null;

  const codeData = data as { clientId: string; redirectUri: string; createdAt: number };

  if (codeData.redirectUri !== redirectUri) return null;

  await kv.delete(`auth_code:${code}`);

  return { clientId: codeData.clientId };
}

export async function createAccessToken(
  kv: KVNamespace,
  clientId: string
): Promise<{ accessToken: string; expiresIn: number }> {
  const accessToken = crypto.randomUUID();
  const expiresIn = 86400 * 30;

  await kv.put(
    `access_token:${accessToken}`,
    JSON.stringify({
      clientId,
      createdAt: Date.now(),
    }),
    { expirationTtl: expiresIn }
  );

  return { accessToken, expiresIn };
}

export async function validateAccessToken(
  kv: KVNamespace,
  token: string
): Promise<{ clientId: string } | null> {
  const data = await kv.get(`access_token:${token}`, "json");
  if (!data) return null;
  return data as { clientId: string };
}

export async function revokeAccessToken(
  kv: KVNamespace,
  token: string
): Promise<void> {
  await kv.delete(`access_token:${token}`);
}

import { createClient } from "npm:@supabase/supabase-js@2";

export type ConfirmationToken = {
  sub: string;
  email?: string;
  exp: number;
  type?: "email_confirmation";
};

export const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-signature, x-signature",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const encoder = new TextEncoder();
const decoder = new TextDecoder();

export function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

export function noContent(): Response {
  return new Response(null, {
    status: 204,
    headers: corsHeaders,
  });
}

export function getEnv(name: string, required = true): string {
  const value = String(Deno.env.get(name) || "").trim();
  if (!value && required) {
    throw new Error(`Missing env ${name}`);
  }
  return value;
}

export function normalizeUrl(url: string): string {
  return String(url || "").trim().replace(/\/+$/, "");
}

export function buildConfirmPageUrl(baseUrl: string, token: string): string {
  return `${normalizeUrl(baseUrl)}/confirm.html?token=${encodeURIComponent(token)}`;
}

export function createAdminClient() {
  const serviceRoleKey = getEnv("SUPABASE_SERVICE_ROLE_KEY", false) || getEnv("SERVICE_ROLE_KEY");
  return createClient(getEnv("SUPABASE_URL"), serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

export function escapeHtml(value: string): string {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = "";
  const chunkSize = 0x8000;
  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes).map((value) => value.toString(16).padStart(2, "0")).join("");
}

function base64UrlToBytes(input: string): Uint8Array {
  const normalized = input.replace(/-/g, "+").replace(/_/g, "/");
  const padding = (4 - (normalized.length % 4 || 4)) % 4;
  const padded = `${normalized}${"=".repeat(padding)}`;
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

async function signHmac(secret: string, value: string): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(value)));
}

function safeCompare(left: string, right: string): boolean {
  const a = encoder.encode(String(left || ""));
  const b = encoder.encode(String(right || ""));
  const size = Math.max(a.length, b.length);
  let mismatch = a.length === b.length ? 0 : 1;
  for (let index = 0; index < size; index += 1) {
    mismatch |= (a[index] || 0) ^ (b[index] || 0);
  }
  return mismatch === 0;
}

export async function matchesWebhookSignature(secret: string, bodyText: string, signatureHeader: string): Promise<boolean> {
  const provided = String(signatureHeader || "").trim().replace(/^sha256=/i, "");
  if (!provided) return false;

  const signature = await signHmac(secret, bodyText);
  const expectedBase64Url = bytesToBase64Url(signature);
  const expectedHex = bytesToHex(signature);

  return safeCompare(provided, expectedBase64Url) || safeCompare(provided.toLowerCase(), expectedHex);
}

export async function signConfirmationToken(payload: ConfirmationToken, secret: string): Promise<string> {
  const encodedPayload = bytesToBase64Url(encoder.encode(JSON.stringify(payload)));
  const signature = bytesToBase64Url(await signHmac(secret, encodedPayload));
  return `${encodedPayload}.${signature}`;
}

export async function readConfirmationToken(token: string, secret: string): Promise<ConfirmationToken | null> {
  const [encodedPayload, providedSignature] = String(token || "").trim().split(".");
  if (!encodedPayload || !providedSignature) return null;

  const signatureBytes = await signHmac(secret, encodedPayload);
  const expectedBase64Url = bytesToBase64Url(signatureBytes);
  const expectedHex = bytesToHex(signatureBytes);
  if (
    !safeCompare(providedSignature, expectedBase64Url) &&
    !safeCompare(providedSignature.toLowerCase(), expectedHex)
  ) {
    return null;
  }

  try {
    let parsed: unknown;
    try {
      parsed = JSON.parse(decoder.decode(base64UrlToBytes(encodedPayload)));
    } catch (_error) {
      parsed = JSON.parse(atob(encodedPayload));
    }
    if (
      !parsed ||
      typeof parsed !== "object" ||
      typeof parsed.sub !== "string" ||
      typeof parsed.exp !== "number" ||
      ("email" in parsed && parsed.email != null && typeof parsed.email !== "string") ||
      ("type" in parsed && parsed.type != null && parsed.type !== "email_confirmation")
    ) {
      return null;
    }
    return parsed as ConfirmationToken;
  } catch (_error) {
    return null;
  }
}

export function ttlHours(ttlSeconds: number): string {
  const hours = Number(ttlSeconds) / 3600;
  if (!Number.isFinite(hours) || hours <= 0) return "24";
  return Number.isInteger(hours) ? String(hours) : hours.toFixed(1).replace(/\.0$/, "");
}

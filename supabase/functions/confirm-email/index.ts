import {
  createAdminClient,
  getEnv,
  json,
  noContent,
  normalizeUrl,
  readConfirmationToken,
} from "../_shared/confirmation.ts";

function normalizeEmail(value: unknown): string {
  return String(value || "").trim().toLowerCase();
}

function buildLoginRedirect(code?: string): string {
  const baseUrl = getEnv("BASE_URL", false);
  if (!baseUrl) return "";
  const url = new URL(`${normalizeUrl(baseUrl)}/login.html`);
  if (code) {
    url.searchParams.set("confirm_error", code);
  } else {
    url.searchParams.set("confirmed", "1");
  }
  return url.toString();
}

function responseFor(method: string, body: unknown, status: number, code?: string): Response {
  if (method === "GET") {
    const successRedirect = getEnv("CONFIRM_REDIRECT", false) || buildLoginRedirect();
    const errorRedirect = buildLoginRedirect(code);
    const location = status >= 400 ? errorRedirect : successRedirect;
    if (location) {
      return Response.redirect(location, 302);
    }
  }
  return json(body, status);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return noContent();
  if (req.method !== "GET" && req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  try {
    let token = "";
    if (req.method === "GET") {
      token = String(new URL(req.url).searchParams.get("token") || "").trim();
    } else {
      const body = await req.json().catch(() => null);
      token = String(body?.token || "").trim();
    }

    if (!token) {
      return responseFor(req.method, { error: "missing_token" }, 400, "missing_token");
    }

    const parsed = await readConfirmationToken(token, getEnv("SECRET_CONFIRM_JWT"));
    if (!parsed) {
      return responseFor(req.method, { error: "invalid_token" }, 401, "invalid_token");
    }
    if (parsed.exp <= Math.floor(Date.now() / 1000)) {
      return responseFor(req.method, { error: "expired_token" }, 401, "expired_token");
    }

    const admin = createAdminClient();
    const { data, error } = await admin.auth.admin.getUserById(parsed.sub);
    if (error) {
      console.error("[confirm-email] lookup error", error);
      return responseFor(
        req.method,
        { error: "user_lookup_failed", details: error.message || String(error) },
        500,
        "user_lookup_failed",
      );
    }

    const authUser = data?.user;
    if (!authUser?.id || !authUser.email) {
      return responseFor(req.method, { error: "user_not_found" }, 404, "user_not_found");
    }
    if (parsed.email && normalizeEmail(authUser.email) !== normalizeEmail(parsed.email)) {
      return responseFor(req.method, { error: "stale_token" }, 401, "stale_token");
    }

    if (authUser.email_confirmed_at) {
      return responseFor(req.method, { ok: true, alreadyConfirmed: true }, 200);
    }

    const { error: updateError } = await admin.auth.admin.updateUserById(authUser.id, {
      email_confirm: true,
    });

    if (updateError) {
      console.error("[confirm-email] update error", updateError);
      return responseFor(
        req.method,
        { error: "update_failed", details: updateError.message || String(updateError) },
        500,
        "update_failed",
      );
    }

    return responseFor(req.method, { ok: true }, 200);
  } catch (error) {
    console.error("[confirm-email]", error);
    return responseFor(req.method, { error: "internal_error", details: String(error) }, 500, "internal_error");
  }
});

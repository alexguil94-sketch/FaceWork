import {
  buildConfirmPageUrl,
  createAdminClient,
  escapeHtml,
  getEnv,
  json,
  matchesWebhookSignature,
  noContent,
  signConfirmationToken,
  ttlHours,
  type ConfirmationToken,
} from "../_shared/confirmation.ts";

type LoosePayload = {
  email?: unknown;
  userId?: unknown;
  user?: { id?: unknown; email?: unknown } | null;
  data?: { user?: { id?: unknown; email?: unknown } | null } | null;
  record?: { id?: unknown; email?: unknown } | null;
};

function normalizeEmail(value: unknown): string {
  return String(value || "").trim().toLowerCase();
}

function normalizeId(value: unknown): string {
  return String(value || "").trim();
}

function extractCandidate(payload: LoosePayload) {
  const nestedUser = payload?.user ?? payload?.data?.user ?? payload?.record ?? null;
  return {
    email: normalizeEmail(payload?.email ?? nestedUser?.email),
    userId: normalizeId(payload?.userId ?? nestedUser?.id),
  };
}

function hasCandidate(payload: LoosePayload): boolean {
  const candidate = extractCandidate(payload);
  return !!(candidate.email || candidate.userId);
}

function buildEmailHtml(confirmUrl: string, ttlLabel: string): string {
  const safeUrl = escapeHtml(confirmUrl);
  return `<!doctype html>
<html lang="fr">
  <body style="margin:0;padding:0;background:#07131f;color:#eff4ff;font-family:Arial,Helvetica,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#07131f;padding:28px 14px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:620px;background:#0f1e2f;border:1px solid rgba(255,255,255,0.08);border-radius:24px;overflow:hidden;">
            <tr>
              <td style="padding:18px 24px;background:linear-gradient(120deg,#2ab6ff 0%,#80ebff 45%,#ffb55f 100%);color:#08111f;font-size:11px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;">
                FaceWork
              </td>
            </tr>
            <tr>
              <td style="padding:28px 28px 8px;">
                <h1 style="margin:0;font-size:30px;line-height:1.1;color:#eff4ff;">Confirme ton email</h1>
              </td>
            </tr>
            <tr>
              <td style="padding:0 28px 10px;font-size:15px;line-height:1.7;color:#b6c2dd;">
                Clique sur le bouton ci-dessous pour valider ton compte FaceWork et terminer l'inscription.
              </td>
            </tr>
            <tr>
              <td style="padding:18px 28px 8px;">
                <a href="${safeUrl}" style="display:inline-block;padding:14px 20px;border-radius:14px;background:#80ebff;color:#07131f;text-decoration:none;font-weight:700;">
                  Confirmer mon email
                </a>
              </td>
            </tr>
            <tr>
              <td style="padding:8px 28px 0;font-size:13px;line-height:1.7;color:#b6c2dd;">
                Si le bouton ne fonctionne pas, copie ce lien dans ton navigateur :
              </td>
            </tr>
            <tr>
              <td style="padding:8px 28px 0;font-size:13px;line-height:1.7;color:#80ebff;word-break:break-all;">
                <a href="${safeUrl}" style="color:#80ebff;text-decoration:underline;">${safeUrl}</a>
              </td>
            </tr>
            <tr>
              <td style="padding:18px 28px 28px;font-size:12px;line-height:1.7;color:#8c9ab8;">
                Ce lien expire dans ${ttlLabel} heure(s). Si tu n'es pas a l'origine de cette demande, tu peux ignorer cet email.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

async function resolveUser(payload: LoosePayload) {
  const admin = createAdminClient();
  const candidate = extractCandidate(payload);
  let userId = candidate.userId;

  if (!userId && candidate.email) {
    const { data, error } = await admin
      .from("profiles")
      .select("id,email")
      .ilike("email", candidate.email)
      .limit(1)
      .maybeSingle();

    if (error) {
      throw new Error(error.message || "Unable to resolve user profile");
    }

    userId = normalizeId(data?.id);
  }

  if (!userId) return null;

  const { data, error } = await admin.auth.admin.getUserById(userId);
  if (error) {
    throw new Error(error.message || "Unable to load auth user");
  }

  const authUser = data?.user;
  if (!authUser?.id || !authUser.email) return null;

  return {
    userId: authUser.id,
    email: normalizeEmail(authUser.email),
    alreadyConfirmed: !!authUser.email_confirmed_at,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return noContent();
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  try {
    const bodyText = await req.text();
    const webhookSecret = getEnv("WEBHOOK_SECRET", false);
    const signature = req.headers.get("x-supabase-signature") ?? req.headers.get("x-signature") ?? "";
    if (webhookSecret && signature) {
      const valid = await matchesWebhookSignature(webhookSecret, bodyText, signature);
      if (!valid) return json({ error: "invalid_signature" }, 401);
    }

    const payload = bodyText ? JSON.parse(bodyText) as LoosePayload : {};
    if (!hasCandidate(payload)) {
      return json({ error: "invalid_payload" }, 400);
    }

    const resolved = await resolveUser(payload);
    if (!resolved) {
      return json({ ok: true }, 200);
    }
    if (resolved.alreadyConfirmed) {
      return json({ ok: true, alreadyConfirmed: true }, 200);
    }

    const secret = getEnv("SECRET_CONFIRM_JWT");
    const baseUrl = getEnv("BASE_URL");
    const resendApiKey = getEnv("RESEND_API_KEY");
    const fromEmail = getEnv("FROM_EMAIL");
    const ttlSeconds = Number.parseInt(getEnv("TOKEN_TTL_SECONDS", false) || "86400", 10);
    const expiresAt = Math.floor(Date.now() / 1000) + (Number.isFinite(ttlSeconds) && ttlSeconds > 0 ? ttlSeconds : 86400);

    const tokenPayload: ConfirmationToken = {
      sub: resolved.userId,
      email: resolved.email,
      exp: expiresAt,
      type: "email_confirmation",
    };

    const token = await signConfirmationToken(tokenPayload, secret);
    const confirmUrl = buildConfirmPageUrl(baseUrl, token);
    const ttlLabel = ttlHours(ttlSeconds);
    const subject = "Confirme ton email FaceWork";
    const text = [
      "Bonjour,",
      "",
      `Merci pour ton inscription sur FaceWork. Confirme ton email ici : ${confirmUrl}`,
      "",
      `Ce lien expire dans ${ttlLabel} heure(s).`,
    ].join("\n");
    const html = buildEmailHtml(confirmUrl, ttlLabel);

    const resendResp = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: fromEmail,
        to: resolved.email,
        subject,
        text,
        html,
      }),
    });

    if (!resendResp.ok) {
      const detail = await resendResp.text();
      console.error("[send-confirmation] resend error", resendResp.status, detail);
      return json({ error: "resend_api_error", details: detail }, 502);
    }

    return json({ ok: true }, 200);
  } catch (error) {
    console.error("[send-confirmation]", error);
    return json({ error: "internal_error", details: String(error) }, 500);
  }
});

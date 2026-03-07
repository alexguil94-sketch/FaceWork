# Supabase Functions

This folder contains an optional custom email-confirmation flow for FaceWork.

## What it does

- `send-confirmation` sends a branded confirmation email through Resend.
- `confirm-email` validates the signed token and marks the Supabase Auth user as confirmed.
- `_shared/confirmation.ts` contains shared helpers (HMAC, CORS, env handling).

## Important scope

This repo still uses the native Supabase `signUp()` flow for the first confirmation email.
The custom function added here is mainly used as a resend path from `login.html` when a user clicks "renvoyer l'email".

If you want the very first signup email to also go through Resend, the signup flow must move server-side. A client-side `auth.signUp()` call will still let Supabase send its own confirmation email.

## Required secrets

Set these secrets in Supabase Edge Functions:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY` or `SERVICE_ROLE_KEY`
- `SECRET_CONFIRM_JWT`
- `RESEND_API_KEY`
- `FROM_EMAIL`
- `BASE_URL`

Optional:

- `WEBHOOK_SECRET`
- `TOKEN_TTL_SECONDS` (default: `86400`)

## Deploy

```bash
supabase functions deploy send-confirmation
supabase functions deploy confirm-email
```

## Browser flow

1. The user requests a resend from `login.html`.
2. The browser invokes `send-confirmation` with the public Supabase key already configured in `js/env.js`.
3. The email links to `/confirm.html?token=...`.
4. `confirm.html` invokes `confirm-email`.
5. The user is redirected back to `login.html?confirmed=1`.

`confirm-email` also accepts direct `GET` requests with `?token=...` and can redirect server-side via `CONFIRM_REDIRECT`.

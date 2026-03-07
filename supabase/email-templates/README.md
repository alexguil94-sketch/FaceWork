# Email templates

This folder stores branded Supabase auth email templates for the project.

## Confirm sign up

Use `confirm-signup.html` for the `Confirm sign up` template in Supabase.

Suggested subject:

```txt
Confirme ton email
```

Supabase dashboard path:

1. `Authentication`
2. `Email Templates`
3. `Confirm sign up`
4. Paste the content of `confirm-signup.html`
5. Save

Notes:

- The template uses `{{ .ConfirmationURL }}` for the CTA and fallback link.
- The logo path is based on `{{ .SiteURL }}` so your `Site URL` must be set correctly in Supabase.
- For real production sending to non-team addresses, configure custom SMTP in Supabase Auth.

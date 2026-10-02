// Generates supabase/templates/*.html from one layout. Colours come from
// src/styles/theme.css: --bg #f7f7ff, --accent #6b34e0, --brand #f05828, and
// the primary button's --primary-strong -> --primary gradient. Each gradient
// has a solid bgcolor fallback for clients that drop gradients (Outlook).
// Variables are Supabase's Go-template ones, checked against
// supabase.com/docs/guides/local-development/customizing-email-templates
// (2026-10-02): which ones exist depends on the template.
// Edit this file, not the .html files, then run:
//   node supabase/templates/build.mjs                 writes the .html files here
//   node supabase/templates/build.mjs --preview DIR   sample-filled copies in DIR
// and paste the changed files into Supabase (docs/support/messaging/transactional-email.md).
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const here = path.dirname(fileURLToPath(import.meta.url));
const ADDRESS = "Made for Stream &middot; P.O. Box 34086, Calgary RPO Westbrook, Alberta, Canada T3C 3W2";

// action: { button } for a link email, { code: true } for a 6-digit code,
// or omitted for a notice. Notices end with the "wasn't you?" warning.
const layout = ({ preheader, heading, intro, action, after }) => `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="color-scheme" content="light dark" />
    <meta name="supported-color-schemes" content="light dark" />
    <title>${heading}</title>
    <style>
      /* Dark mode, from src/styles/theme.css's dark tokens. Honoured by Apple
         Mail, iOS Mail and Outlook for Mac; Gmail ignores it and applies its
         own darkening to the light version. */
      @media (prefers-color-scheme: dark) {
        .mfs-bg { background:#111018 !important; }
        .mfs-card { background:#1a1922 !important; border-color:#2b2a36 !important; }
        .mfs-ink { color:#ededf5 !important; }
        .mfs-text { color:#c9c5ea !important; }
        .mfs-muted, .mfs-muted a { color:#a8a6b6 !important; }
        .mfs-faint { color:#7d7b8c !important; }
        .mfs-rule { border-top-color:#2b2a36 !important; }
        .mfs-btn { background-color:#ededf5 !important; background-image:linear-gradient(180deg,#ffffff,#e8e8f4) !important; }
        .mfs-btn a { color:#111018 !important; }
        .mfs-code { background:#20202c !important; border-color:#2b2a36 !important; color:#ededf5 !important; }
        .mfs-warn { background:#2a1d18 !important; border-color:#5a3324 !important; color:#f3c9b8 !important; }
      }
    </style>
  </head>
  <body class="mfs-bg" style="margin:0;padding:0;background:#f7f7ff;font-family:Arial,Helvetica,sans-serif;color:#18181b;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${preheader}</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" class="mfs-bg" style="background:#f7f7ff;padding:32px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" class="mfs-card" style="max-width:480px;background:#ffffff;border-radius:10px;border:1px solid #e6e4f5;">
            <tr><td bgcolor="#6b34e0" style="background-color:#6b34e0;background-image:linear-gradient(120deg,#6b34e0 0%,#a0459c 55%,#f05828 100%);border-radius:10px 10px 0 0;padding:22px 32px;">
              <p style="margin:0;font-size:17px;font-weight:bold;letter-spacing:0.01em;color:#ffffff;">Made for Stream</p>
            </td></tr>
            <tr><td style="padding:32px;">
              <h1 class="mfs-ink" style="font-size:20px;line-height:1.3;margin:0 0 12px;color:#18181b;">${heading}</h1>
              <p class="mfs-text" style="margin:0 0 24px;font-size:15px;line-height:1.6;color:#3f3f46;">${intro}</p>${
                action?.button
                  ? `
              <table role="presentation" cellpadding="0" cellspacing="0"><tr><td bgcolor="#33209a" class="mfs-btn" style="border-radius:8px;background-color:#33209a;background-image:linear-gradient(180deg,#33209a,#271870);">
                <a href="{{ .ConfirmationURL }}" style="display:inline-block;padding:12px 22px;color:#ffffff;text-decoration:none;font-size:15px;font-weight:bold;border-radius:8px;">${action.button}</a>
              </td></tr></table>`
                  : action?.code
                    ? `
              <p class="mfs-code" style="margin:0;display:inline-block;padding:14px 22px;font-size:28px;font-weight:bold;letter-spacing:0.25em;font-family:'Courier New',Courier,monospace;color:#18181b;background:#f4f3fc;border:1px solid #e6e4f5;border-radius:8px;">{{ .Token }}</p>`
                    : `
              <p class="mfs-warn" style="margin:0;padding:12px 14px;font-size:14px;line-height:1.6;color:#7c2d12;background:#fff4ee;border:1px solid #fbd5c3;border-radius:8px;"><strong>Wasn't you?</strong> Contact <a href="mailto:support@madeforstream.com" style="color:inherit;">support@madeforstream.com</a> straight away so we can secure your account.</p>`
              }
              <p class="mfs-muted" style="margin:24px 0 0;font-size:13px;line-height:1.6;color:#71717a;">${after}</p>${
                action?.button
                  ? `
              <p class="mfs-faint" style="margin:16px 0 0;font-size:12px;line-height:1.6;color:#a1a1aa;word-break:break-all;">If the button doesn't work, copy this link into your browser:<br />{{ .ConfirmationURL }}</p>`
                  : ""
              }
              <p class="mfs-muted mfs-rule" style="margin:32px 0 0;padding-top:16px;border-top:1px solid #e4e4e7;color:#71717a;font-size:12px;line-height:1.6;">
                ${ADDRESS}<br />
                Questions? <a href="mailto:support@madeforstream.com" style="color:#71717a;">support@madeforstream.com</a>
                &middot; <a href="{{ .SiteURL }}" style="color:#71717a;">Made for Stream</a>
              </p>
            </td></tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>
`;

const once = "The link works once and expires soon.";
const notice = "This is a security notice about your Made for Stream account. You don't need to do anything if this was you.";

// file name -> Supabase dashboard name, subject, content
export const templates = {
  // ---- Authentication
  confirmation: {
    dashboard: "Confirm signup",
    subject: "Confirm your email for Made for Stream",
    preheader: "One click to finish setting up your Made for Stream account.",
    heading: "Confirm your email",
    intro: "Thanks for joining Made for Stream. Confirm this is your email address to finish setting up your account.",
    action: { button: "Confirm email" },
    after: `${once} If you didn't ask for this, you can ignore this email.`,
  },
  invite: {
    dashboard: "Invite user",
    subject: "You're invited to Made for Stream",
    preheader: "Accept your invitation to Made for Stream.",
    heading: "You're invited",
    intro: "You've been invited to Made for Stream, the marketplace for streamers and creators. Accept the invitation to set up your account.",
    action: { button: "Accept invitation" },
    after: `${once} If you weren't expecting this, you can ignore this email.`,
  },
  magic_link: {
    dashboard: "Magic link",
    subject: "Your Made for Stream sign-in link",
    preheader: "Use this link to sign in to Made for Stream.",
    heading: "Sign in to Made for Stream",
    intro: "Use the button below to sign in. No password needed.",
    action: { button: "Sign in" },
    after: `${once} If you didn't try to sign in, you can ignore this email: your account stays as it is.`,
  },
  email_change: {
    dashboard: "Change email address",
    subject: "Confirm your new email address",
    preheader: "Confirm the change to your Made for Stream email address.",
    heading: "Confirm your new email address",
    intro: "You asked to change the email address on your Made for Stream account from <strong>{{ .Email }}</strong> to <strong>{{ .NewEmail }}</strong>. Confirm to finish the change.",
    action: { button: "Confirm new email" },
    after: `${once} If you didn't ask for this, ignore this email: your email address stays as it is.`,
  },
  recovery: {
    dashboard: "Reset password",
    subject: "Reset your Made for Stream password",
    preheader: "Use this link to choose a new password.",
    heading: "Reset your password",
    intro: "We received a request to reset the password for <strong>{{ .Email }}</strong>. Use the button below to choose a new one.",
    action: { button: "Reset password" },
    after: `${once} If you didn't ask for this, ignore this email: your password stays as it is.`,
  },
  reauthentication: {
    dashboard: "Reauthentication",
    subject: "Your Made for Stream verification code",
    preheader: "Enter this code to confirm it's you.",
    heading: "Confirm it's you",
    intro: "Enter this code in Made for Stream to continue with the change you started:",
    action: { code: true },
    after: "The code works once and expires soon. Never share it with anyone, including Made for Stream staff. If you didn't start a change, someone may have access to your account: contact support@madeforstream.com.",
  },

  // ---- Security notices (sent only if switched on in the project)
  password_changed_notification: {
    dashboard: "Password changed",
    subject: "Your Made for Stream password was changed",
    preheader: "The password on your account was just changed.",
    heading: "Your password was changed",
    intro: "The password for <strong>{{ .Email }}</strong> on Made for Stream was just changed.",
    after: notice,
  },
  email_changed_notification: {
    dashboard: "Email address changed",
    subject: "Your Made for Stream email address was changed",
    preheader: "The email address on your account was just changed.",
    heading: "Your email address was changed",
    intro: "The email address on your Made for Stream account was changed from <strong>{{ .OldEmail }}</strong> to <strong>{{ .Email }}</strong>.",
    after: notice,
  },
  phone_changed_notification: {
    dashboard: "Phone number changed",
    subject: "Your Made for Stream phone number was changed",
    preheader: "The phone number on your account was just changed.",
    heading: "Your phone number was changed",
    intro: "The phone number on your Made for Stream account was changed from <strong>{{ .OldPhone }}</strong> to <strong>{{ .Phone }}</strong>.",
    after: notice,
  },
  identity_linked_notification: {
    dashboard: "Sign-in method linked",
    subject: "A sign-in method was added to your Made for Stream account",
    preheader: "You can now sign in another way.",
    heading: "New sign-in method added",
    intro: "Your <strong>{{ .Provider }}</strong> account can now be used to sign in to Made for Stream as <strong>{{ .Email }}</strong>.",
    after: notice,
  },
  identity_unlinked_notification: {
    dashboard: "Sign-in method removed",
    subject: "A sign-in method was removed from your Made for Stream account",
    preheader: "One of your sign-in methods was removed.",
    heading: "Sign-in method removed",
    intro: "Your <strong>{{ .Provider }}</strong> account can no longer be used to sign in to Made for Stream as <strong>{{ .Email }}</strong>.",
    after: notice,
  },
  mfa_factor_enrolled_notification: {
    dashboard: "MFA method added",
    subject: "A verification method was added to your Made for Stream account",
    preheader: "Your account has a new verification method.",
    heading: "Verification method added",
    intro: "A <strong>{{ .FactorType }}</strong> verification method was added to your Made for Stream account (<strong>{{ .Email }}</strong>).",
    after: notice,
  },
  mfa_factor_unenrolled_notification: {
    dashboard: "MFA method removed",
    subject: "A verification method was removed from your Made for Stream account",
    preheader: "A verification method was removed from your account.",
    heading: "Verification method removed",
    intro: "A <strong>{{ .FactorType }}</strong> verification method was removed from your Made for Stream account (<strong>{{ .Email }}</strong>).",
    after: notice,
  },
};

const sample = {
  "{{ .ConfirmationURL }}": "https://itbgxxczuazwroniiyot.supabase.co/auth/v1/verify?token=pkce_abc123&amp;type=magiclink&amp;redirect_to=https://dev.madeforstream.com",
  "{{ .Token }}": "482913",
  "{{ .SiteURL }}": "https://dev.madeforstream.com",
  "{{ .Email }}": "you@example.com",
  "{{ .NewEmail }}": "new@example.com",
  "{{ .OldEmail }}": "old@example.com",
  "{{ .Phone }}": "+1 403 555 0199",
  "{{ .OldPhone }}": "+1 403 555 0100",
  "{{ .Provider }}": "Twitch",
  "{{ .FactorType }}": "authenticator app",
};

// Variables Supabase fills in, per template (docs as above). Anything else
// renders blank in a live email, so the build refuses it.
const common = ["ConfirmationURL", "Token", "TokenHash", "SiteURL", "RedirectTo", "Data", "Email"];
const extra = {
  email_change: ["NewEmail"],
  email_changed_notification: ["OldEmail"],
  phone_changed_notification: ["Phone", "OldPhone"],
  identity_linked_notification: ["Provider"],
  identity_unlinked_notification: ["Provider"],
  mfa_factor_enrolled_notification: ["FactorType"],
  mfa_factor_unenrolled_notification: ["FactorType"],
};

const previewIndex = process.argv.indexOf("--preview");
const previewDir = previewIndex > -1 ? process.argv[previewIndex + 1] : null;

for (const [name, t] of Object.entries(templates)) {
  let html = layout(t);
  const allowed = new Set([...common, ...(extra[name] || [])]);
  for (const [, variable] of html.matchAll(/\{\{ \.(\w+)/g)) {
    if (!allowed.has(variable)) {
      throw new Error(`${name}: {{ .${variable} }} is not available in this Supabase template`);
    }
  }
  if (previewDir) {
    for (const [k, v] of Object.entries(sample)) html = html.replaceAll(k, v);
    fs.writeFileSync(path.join(previewDir, `preview-${name}.html`), html);
  } else {
    fs.writeFileSync(path.join(here, `${name}.html`), html);
  }
  console.log(`${t.dashboard.padEnd(24)} ${(name + ".html").padEnd(40)} ${t.subject}`);
}

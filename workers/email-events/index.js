// Reads Cloudflare Email Sending events (message.bounced,
// message.complained) from the email-events queue and posts each one, as
// is, to the API's POST /api/webhooks/email, which decides what to suppress.
// Playbook: docs/support/messaging/transactional-email.md (EMAIL-002,
// EMAIL-009).
//
// The API answers 400 for an event it will never accept, so that one is
// dropped; anything else that isn't a success (secret not set, API down) is
// retried later, as set in wrangler.jsonc.
export default {
  async queue(batch, env) {
    for (const message of batch.messages) {
      let status = "network error";

      try {
        const response = await fetch(`${env.API_BASE}/api/webhooks/email`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${env.EMAIL_WEBHOOK_SECRET}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(message.body),
        });

        status = response.status;
      } catch {
        // Retried below.
      }

      if (status === 400 || (status >= 200 && status < 300)) {
        message.ack();
      } else {
        console.warn(`EMAIL-009: email event not passed to the API (${status}); retrying.`);
        message.retry();
      }
    }
  },
};

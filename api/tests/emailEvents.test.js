import { afterEach, describe, expect, it, vi } from "vitest";
import { parseEmailEvent } from "../email.js";
import worker from "../../workers/email-events/index.js";

// Shaped like Cloudflare's published examples
// (developers.cloudflare.com/email-service/reference/event-subscriptions/).
const event = (type, bounceType) => ({
  type: `cf.email.sending.message.${type}`,
  source: { type: "email.sending", domain: "send.madeforstream.com" },
  payload: {
    messageId: "0101018f7d0c4d9a-msg-bounced",
    recipient: "Someone@Example.net",
    ...(bounceType ? { bounce: { type: bounceType, reason: "550 5.1.1 User unknown" } } : {}),
    delivery: { smtpResponse: "550 5.7.1 Reported as spam" },
  },
});

describe("parseEmailEvent", () => {
  it("suppresses a hard bounce with its reason and message id", () => {
    expect(parseEmailEvent(event("bounced", "hard"))).toEqual({
      email: "Someone@Example.net",
      reason: "hard_bounce",
      detail: "550 5.1.1 User unknown",
      providerMessageId: "0101018f7d0c4d9a-msg-bounced",
    });
  });

  it("suppresses a complaint", () => {
    expect(parseEmailEvent(event("complained"))?.reason).toBe("complaint");
  });

  it("keeps the address after a soft bounce or any other event", () => {
    expect(parseEmailEvent(event("bounced", "soft"))).toBeNull();
    expect(parseEmailEvent(event("delivered"))).toBeNull();
    expect(parseEmailEvent({ type: "cf.email.sending.message.complained", payload: {} })).toBeNull();
  });
});

describe("email-events worker", () => {
  afterEach(() => vi.unstubAllGlobals());

  const run = async (respond) => {
    const fetchMock = vi.fn(respond);
    vi.stubGlobal("fetch", fetchMock);
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const message = { body: event("bounced", "hard"), ack: vi.fn(), retry: vi.fn() };

    await worker.queue({ messages: [message] }, { API_BASE: "https://api.test", EMAIL_WEBHOOK_SECRET: "s" });

    return { fetchMock, message };
  };

  it("posts the event to the API with the secret and acks on success", async () => {
    const { fetchMock, message } = await run(async () => ({ status: 200 }));

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.test/api/webhooks/email");
    expect(init.headers.Authorization).toBe("Bearer s");
    expect(JSON.parse(init.body).payload.recipient).toBe("Someone@Example.net");
    expect(message.ack).toHaveBeenCalled();
  });

  it("drops an event the API rejects for good", async () => {
    const { message } = await run(async () => ({ status: 400 }));
    expect(message.ack).toHaveBeenCalled();
  });

  it("retries when the API refuses, fails or can't be reached", async () => {
    for (const respond of [async () => ({ status: 401 }), async () => ({ status: 500 }), async () => { throw new Error("down"); }]) {
      const { message } = await run(respond);
      expect(message.retry).toHaveBeenCalled();
      expect(message.ack).not.toHaveBeenCalled();
    }
  });
});

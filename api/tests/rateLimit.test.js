import { describe, expect, it } from "vitest";
import {
  READS_PER_MINUTE,
  WRITES_PER_MINUTE,
  createRateLimiter,
  requestLimitFor,
} from "../rateLimit.js";

describe("requestLimitFor", () => {
  it.each([
    "/api/health",
    "/api/stripe/webhook",
    "/api/stripe/account-events",
    "/api/webhooks/email",
    "/api/internal/ops/alerts/run",
    "/api/internal/ops/connect-resync",
  ])("never limits %s", (path) => {
    expect(requestLimitFor("POST", path)).toBeNull();
  });

  it("gives reads more room than writes", () => {
    expect(requestLimitFor("GET", "/api/twitch/live")).toBe(READS_PER_MINUTE);
    expect(requestLimitFor("POST", "/api/stripe/checkout/session")).toBe(WRITES_PER_MINUTE);
  });

  it("does not exempt a path that only looks like a webhook", () => {
    expect(requestLimitFor("POST", "/api/stripe/webhook-test")).toBe(WRITES_PER_MINUTE);
  });
});

describe("createRateLimiter", () => {
  const start = () => {
    const clock = { time: 0 };
    return { clock, limiter: createRateLimiter({ now: () => clock.time }) };
  };

  it("refuses past the limit and says when to retry", () => {
    const { clock, limiter } = start();

    expect(limiter.take("a", 2).allowed).toBe(true);
    expect(limiter.take("a", 2).allowed).toBe(true);

    clock.time = 20_000;
    expect(limiter.take("a", 2)).toMatchObject({ allowed: false, retryAfterSeconds: 40 });
  });

  it("flags only the first refusal in a window", () => {
    const { limiter } = start();

    limiter.take("a", 1);

    expect(limiter.take("a", 1).firstRefusal).toBe(true);
    expect(limiter.take("a", 1).firstRefusal).toBe(false);
  });

  it("counts each address separately", () => {
    const { limiter } = start();

    limiter.take("a", 1);

    expect(limiter.take("a", 1).allowed).toBe(false);
    expect(limiter.take("b", 1).allowed).toBe(true);
  });

  it("starts again after a minute", () => {
    const { clock, limiter } = start();

    limiter.take("a", 1);
    limiter.take("a", 1);

    clock.time = 60_000;
    expect(limiter.take("a", 1).allowed).toBe(true);
  });

  it("forgets finished windows so memory cannot grow without end", () => {
    const { clock, limiter } = start();

    limiter.take("a", 1);
    limiter.take("b", 1);

    clock.time = 60_000;
    limiter.sweep();

    expect(limiter.size()).toBe(0);
  });
});

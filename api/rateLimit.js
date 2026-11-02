// Limits how many requests one address can make in a minute, so nobody can run
// up the bill or crowd out other visitors. Reads get far more room than writes:
// they are cheap and cached, and many people can share one address.
// Playbook: docs/support/operations/rate-limits.md.
//
// ponytail: counts live in each copy of the API, so the real limit is this times
// the number of copies running. Use a shared store if that ever matters.

const WINDOW_MS = 60_000;

export const READS_PER_MINUTE = 600;
export const WRITES_PER_MINUTE = 60;

export const RATE_LIMIT_MESSAGE = "Too many requests. Please wait a moment and try again.";

// Calls from Stripe, the email provider and our own scheduler are checked by
// signature or secret, and a refused webhook would mean a missed payment event.
const NEVER_LIMITED = [
  /^\/api\/health$/,
  /^\/api\/stripe\/(webhook|account-events)$/,
  /^\/api\/webhooks\//,
  /^\/api\/internal\//,
];

export const requestLimitFor = (method, path) => {
  if (NEVER_LIMITED.some((pattern) => pattern.test(path))) return null;

  return method === "GET" ? READS_PER_MINUTE : WRITES_PER_MINUTE;
};

export const createRateLimiter = ({ now = Date.now } = {}) => {
  const windows = new Map();

  return {
    take: (key, limit) => {
      const time = now();
      const current = windows.get(key);
      const window =
        current && time < current.endsAt ? current : { count: 0, endsAt: time + WINDOW_MS };

      window.count += 1;
      windows.set(key, window);

      return {
        allowed: window.count <= limit,
        // True once a window, so a flood writes one log line and not thousands.
        firstRefusal: window.count === limit + 1,
        retryAfterSeconds: Math.ceil((window.endsAt - time) / 1000),
      };
    },

    sweep: () => {
      const time = now();

      for (const [key, window] of windows) {
        if (time >= window.endsAt) windows.delete(key);
      }
    },

    size: () => windows.size,
  };
};

// Reference exchange rates for showing approximate prices in a visitor's
// own currency. Display only: nothing is ever charged at these rates.
// Agreements, payments and refunds stay in the creator's currency.
//
// Source: the European Central Bank's daily euro reference rates, published
// once each working day around 16:00 CET. The API fetches them (the
// visitor's browser never talks to the ECB, so no visitor data leaves us)
// and keeps them in memory. If the ECB cannot be reached the last good copy
// is served; with no copy at all the route answers 503 and the website
// simply shows the creator's real prices. See docs/support/payments/
// display-currency.md (CUR-001).

import { SUPPORTED_CURRENCY_CODES } from "./supportedCurrencies.js";

export const ECB_DAILY_RATES_URL =
  "https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml";

const REFRESH_AFTER_MS = 6 * 60 * 60 * 1000;

// Reads the ECB's XML into { base, date, rates }, keeping only the
// currencies the site supports. Rates are "units of that currency per one
// euro", so the euro itself is 1. Returns null if the document is not what
// is expected or a supported currency is missing from it.
export const parseEcbRates = (xml) => {
  const text = String(xml || "");
  const date = /<Cube\s+time=['"](\d{4}-\d{2}-\d{2})['"]/.exec(text)?.[1] ?? null;
  const published = new Map();

  for (const match of text.matchAll(
    /<Cube\s+currency=['"]([A-Z]{3})['"]\s+rate=['"]([0-9.]+)['"]/g,
  )) {
    const rate = Number(match[2]);

    if (Number.isFinite(rate) && rate > 0) {
      published.set(match[1].toLowerCase(), rate);
    }
  }

  published.set("eur", 1);

  const rates = {};

  for (const code of SUPPORTED_CURRENCY_CODES) {
    if (!published.has(code)) return null;

    rates[code] = published.get(code);
  }

  return date ? { base: "eur", date, rates } : null;
};

let cached = null; // { payload, fetchedAt }

// `fetchImpl` and `now` are parameters so the caching can be tested.
export const getExchangeRates = async ({ fetchImpl = fetch, now = Date.now() } = {}) => {
  if (cached && now - cached.fetchedAt < REFRESH_AFTER_MS) {
    return cached.payload;
  }

  try {
    const response = await fetchImpl(ECB_DAILY_RATES_URL, {
      signal: AbortSignal.timeout(8000),
    });

    if (!response.ok) {
      throw new Error(`ECB answered ${response.status}`);
    }

    const payload = parseEcbRates(await response.text());

    if (!payload) {
      throw new Error("ECB rates document was not in the expected form");
    }

    cached = { payload, fetchedAt: now };

    return payload;
  } catch (err) {
    console.warn(
      `CUR-001: exchange rates could not be refreshed (${String(err?.message || err)}); ${cached ? `serving the copy from ${cached.payload.date}` : "no copy to serve"}`,
    );

    // A day-old rate is fine for an "approximate" price.
    return cached?.payload ?? null;
  }
};

export const resetExchangeRatesCacheForTests = () => {
  cached = null;
};

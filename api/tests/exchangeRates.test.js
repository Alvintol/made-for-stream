import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  getExchangeRates,
  parseEcbRates,
  resetExchangeRatesCacheForTests,
} from "../exchangeRates.js";
import { SUPPORTED_CURRENCY_CODES } from "../supportedCurrencies.js";

// Every supported currency except the euro, which the ECB does not list
// (it is the base).
const cubes = (overrides = {}) =>
  SUPPORTED_CURRENCY_CODES.filter((code) => code !== "eur")
    .map((code) => `<Cube currency='${code.toUpperCase()}' rate='${overrides[code] ?? "1.5"}'/>`)
    .join("");

const ecbXml = (overrides) =>
  `<?xml version="1.0"?><gesmes:Envelope><Cube><Cube time='2026-10-06'>${cubes(overrides)}<Cube currency='JPY' rate='178.15'/></Cube></Cube></gesmes:Envelope>`;

const okResponse = (body) => ({ ok: true, status: 200, text: async () => body });

describe("parseEcbRates", () => {
  it("reads the date and the supported currencies, with the euro as 1", () => {
    const parsed = parseEcbRates(ecbXml({ usd: "1.1269", cad: "1.5732" }));

    expect(parsed.base).toBe("eur");
    expect(parsed.date).toBe("2026-10-06");
    expect(parsed.rates.eur).toBe(1);
    expect(parsed.rates.usd).toBe(1.1269);
    expect(parsed.rates.cad).toBe(1.5732);
    expect(Object.keys(parsed.rates).sort()).toEqual([...SUPPORTED_CURRENCY_CODES].sort());
  });

  it("leaves out currencies the site does not support", () => {
    expect(parseEcbRates(ecbXml()).rates.jpy).toBeUndefined();
  });

  it("refuses a document that is missing a supported currency", () => {
    expect(parseEcbRates(ecbXml().replace(/<Cube currency='USD'[^>]*>/, ""))).toBeNull();
  });

  it("refuses anything that is not the rates document", () => {
    expect(parseEcbRates("<html>Service unavailable</html>")).toBeNull();
    expect(parseEcbRates("")).toBeNull();
    expect(parseEcbRates(null)).toBeNull();
  });

  it("ignores a rate that is zero or not a number", () => {
    expect(parseEcbRates(ecbXml({ usd: "0" }))).toBeNull();
  });
});

describe("getExchangeRates", () => {
  beforeEach(() => {
    resetExchangeRatesCacheForTests();
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
  });

  it("fetches once, then serves from memory for six hours", async () => {
    const fetchImpl = vi.fn(async () => okResponse(ecbXml()));

    await getExchangeRates({ fetchImpl, now: 0 });
    await getExchangeRates({ fetchImpl, now: 5 * 60 * 60 * 1000 });

    expect(fetchImpl).toHaveBeenCalledTimes(1);

    await getExchangeRates({ fetchImpl, now: 7 * 60 * 60 * 1000 });

    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("keeps serving the last good copy when the ECB cannot be reached", async () => {
    const good = await getExchangeRates({
      fetchImpl: async () => okResponse(ecbXml({ usd: "1.1269" })),
      now: 0,
    });

    const later = await getExchangeRates({
      fetchImpl: async () => {
        throw new Error("network down");
      },
      now: 24 * 60 * 60 * 1000,
    });

    expect(later).toEqual(good);
    expect(console.warn).toHaveBeenCalledWith(expect.stringMatching(/^CUR-001: /));
  });

  it("answers null when there has never been a good copy", async () => {
    expect(
      await getExchangeRates({ fetchImpl: async () => ({ ok: false, status: 503 }), now: 0 }),
    ).toBeNull();
  });
});

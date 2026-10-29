import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { consumerRightsHeading, consumerRightsNotice, consumerRightsRefusal } from "../listings/consumerRights";

describe("consumer rights", () => {
  it("says the database's refusal word for word", () => {
    const migration = fs
      .readFileSync(
        path.resolve(__dirname, "../../../supabase/migrations/20261029_172_creator_acknowledges_buyer_cancellation_rights.sql"),
        "utf8",
      )
      .replace(/''/g, "'");

    expect(migration).toContain(consumerRightsRefusal);
  });

  it("names the region the buyer's rights come from, never their country", () => {
    expect(consumerRightsHeading("eu")).toBe("This buyer has EU consumer rights");
    expect(consumerRightsHeading("uk")).toBe("This buyer has UK consumer rights");
    expect(consumerRightsNotice("eu")).toMatch(/^This buyer lives in the EU or EEA,/);
    expect(consumerRightsNotice("uk")).toMatch(/^This buyer lives in the UK,/);
  });
});

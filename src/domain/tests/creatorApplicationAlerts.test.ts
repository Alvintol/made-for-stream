import { describe, expect, it } from "vitest";

import { OFFERING_LABELS } from "../../../api/creatorApplicationAlerts.js";
import { APPLICATION_OFFERINGS } from "../creatorApplication/creatorApplication";
import { english } from "../../lib/i18n/i18n";
import { applicationOfferingLabel } from "../creatorApplication/creatorApplication";

describe("the team's new-application email", () => {
  it("names every offering the way the site does, in the same order", () => {
    expect(Object.keys(OFFERING_LABELS)).toEqual([...APPLICATION_OFFERINGS]);

    for (const offering of APPLICATION_OFFERINGS) {
      expect(OFFERING_LABELS[offering as keyof typeof OFFERING_LABELS], offering).toBe(
        english(applicationOfferingLabel(offering)),
      );
    }
  });
});

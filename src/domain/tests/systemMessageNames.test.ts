import { describe, expect, it } from "vitest";

import { nameSystemMessagePeople } from "../conversations/conversations";

const names = { buyerName: "@ImAllBeans", creatorName: "@meowington" };

describe("automatic chat lines name the people", () => {
  it.each([
    [
      "The creator sent a project change order for buyer review: discount",
      "@meowington sent a project change order for @ImAllBeans to review: discount",
    ],
    [
      "The buyer declined the project change order: discount",
      "@ImAllBeans declined the project change order: discount",
    ],
    ["Project agreement accepted by the buyer.", "Project agreement accepted by @ImAllBeans."],
    ["Request accepted by the creator.", "Request accepted by @meowington."],
    [
      "The creator submitted an itemised earned-value statement. The buyer can now accept or dispute it.",
      "@meowington submitted an itemised earned-value statement. @ImAllBeans can now accept or dispute it.",
    ],
    [
      "Stripe confirmed payment for milestone 1: sketches.",
      "Stripe confirmed payment for milestone 1: sketches.",
    ],
  ])("%s", (stored, shown) => {
    expect(nameSystemMessagePeople(stored, names)).toBe(shown);
  });

  it("leaves what someone typed after the colon as written", () => {
    expect(
      nameSystemMessagePeople("The buyer requested revisions to the final project delivery: the buyer wants blue", names),
    ).toBe("@ImAllBeans requested revisions to the final project delivery: the buyer wants blue");
  });
});

import { describe, expect, it } from "vitest";

import {
  describeOffSiteDelivery,
  emptyOffSiteDelivery,
  toOffSiteDeliveryInput,
  validateOffSiteDelivery,
} from "../listings/offSiteDelivery";

describe("off-site delivery record", () => {
  it("asks for nothing while the box is not ticked", () => {
    expect(validateOffSiteDelivery(emptyOffSiteDelivery)).toBeUndefined();
    expect(toOffSiteDeliveryInput(emptyOffSiteDelivery)).toBeNull();

    // Ways chosen and then the box unticked: nothing is sent.
    expect(
      toOffSiteDeliveryInput({ provided: false, methods: ["email"], other: "" }),
    ).toBeNull();
  });

  it("needs at least one way once the box is ticked", () => {
    expect(validateOffSiteDelivery({ provided: true, methods: [], other: "" })).toBe(
      "Choose at least one way the work was sent off site.",
    );
  });

  it("needs a short description for another way", () => {
    const message = "Say how the work was sent off site, in 2 to 80 characters.";

    expect(
      validateOffSiteDelivery({ provided: true, methods: ["other"], other: " x " }),
    ).toBe(message);
    expect(
      validateOffSiteDelivery({ provided: true, methods: ["other"], other: "x".repeat(81) }),
    ).toBe(message);
    expect(
      validateOffSiteDelivery({ provided: true, methods: ["other"], other: "WeTransfer" }),
    ).toBeUndefined();
  });

  it("sends the ways in a fixed order, and the description only for another way", () => {
    expect(
      toOffSiteDeliveryInput({
        provided: true,
        methods: ["other", "email"],
        other: "  a USB stick in the post ",
      }),
    ).toEqual({ methods: ["email", "other"], other: "a USB stick in the post" });

    expect(
      toOffSiteDeliveryInput({ provided: true, methods: ["discord"], other: "left over" }),
    ).toEqual({ methods: ["discord"], other: null });
  });

  it("describes what was recorded for the commission card", () => {
    expect(describeOffSiteDelivery([], null)).toBeNull();
    expect(describeOffSiteDelivery(undefined, null)).toBeNull();
    expect(
      describeOffSiteDelivery(["email", "text_message", "other"], "a USB stick"),
    ).toBe("Email, Text message, Another way (a USB stick)");
  });
});

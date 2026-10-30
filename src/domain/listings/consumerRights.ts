// A buyer with EU, EEA or UK consumer rights can usually cancel within 14
// days. The database labels such a request when it is sent
// (listing_requests.buyer_consumer_rights_region, 20261029_172) and refuses
// the creator's acceptance until they confirm the box below. The buyer's own
// request to start early is consent.earlyStartLabel in
// src/lib/i18n/messages/en.ts.

import { english, type Translate } from "../../lib/i18n/i18n";

export type ConsumerRightsRegion = "eu" | "uk";

export const consumerRightsHeading = (region: ConsumerRightsRegion, t: Translate = english) =>
  t(region === "uk" ? "consumerRights.headingUk" : "consumerRights.headingEu");

export const consumerRightsNotice = (region: ConsumerRightsRegion, t: Translate = english) =>
  t("consumerRights.notice", {
    region: t(region === "uk" ? "consumerRights.regionUk" : "consumerRights.regionEu"),
  });
// Must match the database's refusal word for word (playbook REQ-006).
export const consumerRightsRefusal =
  "Confirm that you understand this buyer's right to cancel within 14 days, then accept the request.";

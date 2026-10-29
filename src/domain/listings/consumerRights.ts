// A buyer with EU, EEA or UK consumer rights can usually cancel within 14
// days. The database labels such a request when it is sent
// (listing_requests.buyer_consumer_rights_region, 20261029_172) and refuses
// the creator's acceptance until they confirm the box below. The buyer's own
// request to start early is consent.earlyStartLabel in
// src/lib/i18n/messages/en.ts.

export type ConsumerRightsRegion = "eu" | "uk";

const regionNames: Record<ConsumerRightsRegion, string> = {
  eu: "the EU or EEA",
  uk: "the UK",
};

export const consumerRightsHeading = (region: ConsumerRightsRegion) =>
  `This buyer has ${region === "uk" ? "UK" : "EU"} consumer rights`;

export const consumerRightsNotice = (region: ConsumerRightsRegion) =>
  `This buyer lives in ${regionNames[region]}, where a consumer can usually cancel a purchase of services within 14 days of agreeing to it. When they accept your agreement, they ask you to start work straight away. If they cancel within those 14 days, they pay for the work you've done so far and the rest is refunded. Once the work is complete and delivered, this right ends. A custom piece is not exempt just because it is made for them.`;

export const consumerRightsAcknowledgementLabel =
  "I understand this buyer can cancel within 14 days, and that if they do, I'm paid only for the work done so far.";

// Must match the database's refusal word for word (playbook REQ-006).
export const consumerRightsRefusal =
  "Confirm that you understand this buyer's right to cancel within 14 days, then accept the request.";

import { describe, expect, it } from "vitest";
import { chunkLogins, toStream, uniqueLogins } from "../twitchLive.js";

describe("uniqueLogins", () => {
  it("normalises, removes repeats and blanks, and sorts", () => {
    expect(uniqueLogins([" Meow ", "@meow", "abby", null, "", "ABBY"])).toEqual(["abby", "meow"]);
  });
});

describe("chunkLogins", () => {
  it("never puts more than 100 logins in a request", () => {
    const logins = Array.from({ length: 250 }, (_, index) => `login${index}`);
    const chunks = chunkLogins(logins);

    expect(chunks.map((chunk) => chunk.length)).toEqual([100, 100, 50]);
    expect(chunks.flat()).toEqual(logins);
  });

  it("has nothing to ask for an empty list", () => {
    expect(chunkLogins([])).toEqual([]);
  });
});

describe("toStream", () => {
  it("keeps the fields the site shows", () => {
    expect(
      toStream({
        user_login: "meow",
        user_name: "Meow",
        title: "Painting",
        game_name: "Art",
        viewer_count: 12,
        started_at: "2026-11-02T00:00:00Z",
        thumbnail_url: "https://example.test/{width}x{height}.jpg",
      })
    ).toEqual({
      login: "meow",
      displayName: "Meow",
      isLive: true,
      title: "Painting",
      gameName: "Art",
      viewerCount: 12,
      startedAt: "2026-11-02T00:00:00Z",
      thumbnailUrl: "https://example.test/{width}x{height}.jpg",
    });
  });
});

// Who is live, as one shared answer for the whole site. Twitch's streams
// endpoint takes 100 logins a request and returns 20 rows unless told otherwise,
// so a long list goes in batches of 100 with first=100.
// Playbook: docs/support/discovery/twitch-live.md.

export const TWITCH_BATCH_SIZE = 100;

export const uniqueLogins = (logins) =>
  [
    ...new Set(
      logins
        .map((login) => String(login ?? "").trim().toLowerCase().replace(/^@+/, ""))
        .filter(Boolean)
    ),
  ].sort();

export const chunkLogins = (logins, size = TWITCH_BATCH_SIZE) => {
  const chunks = [];

  for (let start = 0; start < logins.length; start += size) {
    chunks.push(logins.slice(start, start + size));
  }

  return chunks;
};

export const toStream = (stream) => ({
  login: stream.user_login,
  displayName: stream.user_name,
  isLive: true,
  title: stream.title,
  gameName: stream.game_name,
  viewerCount: stream.viewer_count,
  startedAt: stream.started_at,
  thumbnailUrl: stream.thumbnail_url,
});

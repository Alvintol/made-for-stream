import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { normalizeTwitchLogin, type TwitchStream } from "../domain/twitch";

type TwitchStreamsResponse = { data?: TwitchStream[]; error?: string };

const fetchLiveStreams = async (): Promise<TwitchStream[]> => {
  const base = (import.meta.env.VITE_API_BASE as string | undefined)?.trim();
  const origin = base && base.length > 0 ? base : window.location.origin;

  const r = await fetch(new URL("/api/twitch/live", origin).toString(), {
    headers: { Accept: "application/json" },
  });

  const text = await r.text();

  let json: TwitchStreamsResponse;
  try {
    json = JSON.parse(text) as TwitchStreamsResponse;
  } catch {
    const preview = text.slice(0, 140).replace(/\s+/g, " ");
    throw new Error(
      `API returned non-JSON (${r.status}). Starts with: ${preview}`
    );
  }

  if (!r.ok) {
    throw new Error(json?.error || `Request failed (${r.status})`);
  }

  return json.data ?? [];
};

export const useTwitchStreams = () => {
  const streamsQuery = useQuery<TwitchStream[]>({
    queryKey: ["twitchStreams"],
    queryFn: fetchLiveStreams,

    // Poll every 60s to keep stream status up-to-date.
    refetchInterval: 60_000,

    // Don’t poll when tab is hidden
    refetchIntervalInBackground: false,
  });

  const twitchByLogin = useMemo(() => {
    const map: Record<string, TwitchStream> = {};

    (streamsQuery.data ?? []).forEach((stream) => {
      map[normalizeTwitchLogin(stream.login)] = stream;
    });

    return map;
  }, [streamsQuery.data]);

  return { ...streamsQuery, twitchByLogin };
};

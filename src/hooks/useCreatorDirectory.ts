import { useMemo } from "react";
import { keepPreviousData, useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { normalizeTwitchLogin, type TwitchStream } from "../domain/twitch";
import { toPageOfRows, type PageOfRows } from "../lib/pageOfRows";
import { supabase } from "../lib/supabaseClient";

export const CREATOR_PAGE_SIZE = 24;

export type CreatorDirectoryRow = {
  user_id: string;
  handle: string;
  display_name: string | null;
  bio: string | null;
  avatar_url: string | null;
  twitch_login: string | null;
  twitch_user_id: string | null;
  twitch_url: string | null;
  youtube_user_id: string | null;
  youtube_login: string | null;
  youtube_url: string | null;
  specialties: string[];
  tags: string[];
  listing_count: number;
};

export type LiveCreator = {
  creator: CreatorDirectoryRow;
  stream: TwitchStream;
};

type CreatorDirectoryFilters = {
  q: string;
  onlyOpen: boolean;
  // Limits the list to these Twitch logins, lower case. Null means everyone.
  logins: string[] | null;
};

const fetchCreatorPage = async (
  filters: CreatorDirectoryFilters,
  afterHandle: string | null,
  pageSize: number
): Promise<PageOfRows<CreatorDirectoryRow, string>> => {
  const { data, error } = await supabase.rpc("creator_directory", {
    p_q: filters.q || null,
    p_only_open: filters.onlyOpen,
    p_logins: filters.logins,
    p_after_handle: afterHandle,
    p_limit: pageSize,
  });

  if (error) throw error;

  return toPageOfRows((data ?? []) as CreatorDirectoryRow[], pageSize, (lastRow) => lastRow.handle);
};

export const useCreatorDirectory = (filters: CreatorDirectoryFilters) =>
  useInfiniteQuery({
    queryKey: ["creatorDirectory", filters],
    queryFn: ({ pageParam }) => fetchCreatorPage(filters, pageParam, CREATOR_PAGE_SIZE),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.next,
    placeholderData: keepPreviousData,
    refetchOnWindowFocus: false,
  });

const byViewersDescending = (a: TwitchStream, b: TwitchStream): number =>
  (b.viewerCount ?? 0) - (a.viewerCount ?? 0);

// The `count` most-watched creators who are live, read by name rather than by
// loading every creator. The logins are sorted so the query only repeats when
// the people in the list change, not when their viewer counts do.
export const useLiveCreators = (twitchByLogin: Record<string, TwitchStream>, count: number) => {
  const logins = useMemo(
    () =>
      Object.values(twitchByLogin)
        .sort(byViewersDescending)
        .slice(0, count)
        .map((stream) => normalizeTwitchLogin(stream.login))
        .sort(),
    [twitchByLogin, count]
  );

  const query = useQuery<CreatorDirectoryRow[]>({
    queryKey: ["creatorDirectory", "live", logins],
    enabled: logins.length > 0,
    queryFn: async () => (await fetchCreatorPage({ q: "", onlyOpen: false, logins }, null, count)).rows,
    placeholderData: keepPreviousData,
    staleTime: 5 * 60_000,
  });

  const liveCreators = useMemo(
    () =>
      (query.data ?? [])
        .flatMap((creator): LiveCreator[] => {
          const stream = creator.twitch_login
            ? twitchByLogin[normalizeTwitchLogin(creator.twitch_login)]
            : undefined;

          return stream ? [{ creator, stream }] : [];
        })
        .sort((a, b) => byViewersDescending(a.stream, b.stream)),
    [query.data, twitchByLogin]
  );

  return liveCreators;
};

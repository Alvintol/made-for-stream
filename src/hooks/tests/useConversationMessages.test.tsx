import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

type Call = [string, ...unknown[]];

const mocks = vi.hoisted(() => ({
  reads: [] as Call[][],
  // What each read returns, from the calls that built it.
  answer: (() => ({ data: [], error: null, count: 0 })) as (calls: Call[]) => unknown,
}));

// A stand-in for the Supabase query builder: records each call and answers
// when awaited.
vi.mock("../../lib/supabaseClient", () => ({
  supabase: {
    from: (...args: unknown[]) => {
      const calls: Call[] = [["from", ...args]];
      mocks.reads.push(calls);

      const builder: Record<string, unknown> = {
        then: (resolve: (value: unknown) => void) => resolve(mocks.answer(calls)),
      };

      for (const name of ["select", "eq", "gte", "lte", "order", "limit"]) {
        builder[name] = (...callArgs: unknown[]) => {
          calls.push([name, ...callArgs]);
          return builder;
        };
      }

      return builder;
    },
  },
}));

vi.mock("../../providers/AuthProvider", () => ({
  useAuth: () => ({ user: { id: "buyer-1" }, loading: false }),
}));

import { CHAT_PAGE_SIZE, useConversationMessages } from "../conversations/useConversationMessages";

const message = (index: number, at = new Date(Date.UTC(2026, 0, 1, 0, index)).toISOString()) => ({
  id: `m${index}`,
  conversation_id: "c1",
  sender_user_id: "buyer-1",
  message_type: "text",
  body: `Message ${index}`,
  created_at: at,
});

const has = (calls: Call[], name: string) => calls.some(([called]) => called === name);

const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    {children}
  </QueryClientProvider>
);

describe("useConversationMessages", () => {
  it("reads only the newest page, then the older page when asked", async () => {
    // 150 messages; the oldest loaded one shares its time with an older one.
    const shared = new Date(Date.UTC(2026, 0, 1, 0, 50)).toISOString();
    const all = Array.from({ length: 150 }, (_, index) => message(index, index === 49 ? shared : undefined));

    mocks.answer = (calls) => {
      if (has(calls, "limit")) {
        const limit = calls.find(([name]) => name === "limit")?.[1] as number;
        const upTo = calls.find(([name]) => name === "lte")?.[2] as string | undefined;
        const rows = all.filter((row) => !upTo || row.created_at <= upTo).reverse();

        return { data: rows.slice(0, limit), error: null };
      }

      const upTo = calls.find(([name]) => name === "lte")?.[2] as string;

      return { data: null, error: null, count: all.filter((row) => row.created_at <= upTo).length };
    };

    const { result } = renderHook(() => useConversationMessages("c1"), { wrapper });

    await waitFor(() => expect(result.current.messages).toHaveLength(CHAT_PAGE_SIZE));
    expect(result.current.messages[0].id).toBe("m50");
    expect(result.current.messages.at(-1)?.id).toBe("m149");
    expect(mocks.reads[0]).toContainEqual(["order", "created_at", { ascending: false }]);

    await waitFor(() => expect(result.current.hasEarlier).toBe(true));

    await act(() => result.current.loadEarlierMutation.mutateAsync());

    // m49 shares m50's time, so it is still found; nothing is lost or doubled.
    await waitFor(() => expect(result.current.messages).toHaveLength(150));
    expect(new Set(result.current.messages.map((row) => row.id)).size).toBe(150);
    expect(result.current.messages[0].id).toBe("m0");
    expect(result.current.earlierCount).toBe(50);
    await waitFor(() => expect(result.current.hasEarlier).toBe(false));
  });
});

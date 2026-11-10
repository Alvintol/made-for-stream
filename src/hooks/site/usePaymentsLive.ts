import { useQuery } from "@tanstack/react-query";
import { supabase } from "../../lib/supabaseClient";

// Whether payments are open (20261110_193). The database's switch, so the
// site can't disagree with the rules that enforce it. Until it answers, or
// if it can't be read, the site treats payments as closed.
export const usePaymentsLive = (): boolean => {
  const { data } = useQuery({
    queryKey: ["paymentsLive"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("payments_are_live");
      if (error) throw error;
      return data === true;
    },
    staleTime: Infinity,
  });

  return data === true;
};

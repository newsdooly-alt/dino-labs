import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl, type InsertUserStock } from "@shared/routes";

const USER_ID = 1;

export function useWatchlist() {
  return useQuery({
    queryKey: [api.watchlist.list.path, USER_ID],
    queryFn: async () => {
      const url = `${api.watchlist.list.path}?userId=${USER_ID}`;
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error('Failed to fetch watchlist');
      return api.watchlist.list.responses[200].parse(await res.json());
    },
    // Refresh prices occasionally
    refetchInterval: 15000, 
  });
}

export function useAddToWatchlist() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (symbol: string) => {
      const data: InsertUserStock = { userId: USER_ID, symbol: symbol.toUpperCase() };
      const res = await fetch(api.watchlist.add.path, {
        method: api.watchlist.add.method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!res.ok) throw new Error('Failed to add to watchlist');
      return api.watchlist.add.responses[201].parse(await res.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.watchlist.list.path, USER_ID] });
    },
  });
}

export function useRemoveFromWatchlist() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (symbol: string) => {
      const url = buildUrl(api.watchlist.remove.path, { symbol });
      const res = await fetch(`${url}?userId=${USER_ID}`, {
        method: api.watchlist.remove.method,
        credentials: "include",
      });
      if (!res.ok) throw new Error('Failed to remove from watchlist');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.watchlist.list.path, USER_ID] });
    },
  });
}

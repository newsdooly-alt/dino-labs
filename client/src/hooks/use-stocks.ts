import { useQuery } from "@tanstack/react-query";
import { api, buildUrl } from "@shared/routes";

export function useStockSearch(query: string) {
  return useQuery({
    queryKey: [api.stocks.search.path, query],
    queryFn: async () => {
      if (!query) return [];
      const url = `${api.stocks.search.path}?query=${encodeURIComponent(query)}`;
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error('Failed to search stocks');
      return api.stocks.search.responses[200].parse(await res.json());
    },
    enabled: query.length > 1,
  });
}

export function useStockQuote(symbol: string) {
  return useQuery({
    queryKey: [api.stocks.quote.path, symbol],
    queryFn: async () => {
      const url = buildUrl(api.stocks.quote.path, { symbol });
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error('Failed to fetch quote');
      return api.stocks.quote.responses[200].parse(await res.json());
    },
    // Refresh every 10 seconds for "real-time" feel
    refetchInterval: 10000, 
  });
}

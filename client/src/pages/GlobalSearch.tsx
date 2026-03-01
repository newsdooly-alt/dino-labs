import { useState, useEffect, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Search, TrendingUp, TrendingDown, Loader2, Globe } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useCurrency } from "@/contexts/CurrencyContext";
import { useUser } from "@/hooks/use-user";
import { translations } from "@/lib/translations";
import { motion, AnimatePresence } from "framer-motion";

interface SearchResult {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  currency?: string;
  exchange?: string;
  sector?: string;
}

type ExchangeFilter = "all" | "us" | "kr" | "jp" | "eu";

function getExchangeFilter(symbol: string): ExchangeFilter {
  const s = symbol.toUpperCase();
  if (s.endsWith(".KS") || s.endsWith(".KQ")) return "kr";
  if (s.endsWith(".T")) return "jp";
  if (s.endsWith(".DE") || s.endsWith(".PA") || s.endsWith(".MI") || s.endsWith(".AS") ||
      s.endsWith(".SW") || s.endsWith(".L") || s.endsWith(".MC") || s.endsWith(".ST") ||
      s.endsWith(".VI") || s.endsWith(".OL")) return "eu";
  return "us";
}

function getExchangeFlag(symbol: string): string {
  const filter = getExchangeFilter(symbol);
  switch (filter) {
    case "kr": return "🇰🇷";
    case "jp": return "🇯🇵";
    case "eu": return "🇪🇺";
    default: return "🇺🇸";
  }
}

function getNativeCurrency(symbol: string): string {
  const filter = getExchangeFilter(symbol);
  switch (filter) {
    case "kr": return "KRW";
    case "jp": return "JPY";
    case "eu": return "EUR";
    default: return "USD";
  }
}

export default function GlobalSearch() {
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [filter, setFilter] = useState<ExchangeFilter>("all");
  const [, navigate] = useLocation();
  const { data: user } = useUser();
  const lang = (user?.language || "en") as keyof typeof translations;
  const t = translations[lang];
  const { formatPrice } = useCurrency();

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query.trim());
    }, 400);
    return () => clearTimeout(timer);
  }, [query]);

  const { data, isLoading } = useQuery<{ results: SearchResult[] }>({
    queryKey: ["/api/stocks/search", debouncedQuery],
    queryFn: async () => {
      if (debouncedQuery.length < 2) return { results: [] };
      const res = await fetch(`/api/stocks/search?query=${encodeURIComponent(debouncedQuery)}`, { credentials: "include" });
      if (!res.ok) throw new Error("Search failed");
      return res.json();
    },
    enabled: debouncedQuery.length >= 2,
    staleTime: 30_000,
  });

  const results: SearchResult[] = data?.results ?? (data as any) ?? [];
  const filteredResults = filter === "all"
    ? results
    : results.filter(r => getExchangeFilter(r.symbol) === filter);

  const filterTabs: { key: ExchangeFilter; label: string; flag: string }[] = [
    { key: "all", label: t.search_all, flag: "🌍" },
    { key: "us",  label: t.search_filter_us, flag: "🇺🇸" },
    { key: "kr",  label: t.search_filter_kr, flag: "🇰🇷" },
    { key: "jp",  label: t.search_filter_jp, flag: "🇯🇵" },
    { key: "eu",  label: t.search_filter_eu, flag: "🇪🇺" },
  ];

  return (
    <div className="p-4 md:p-8 max-w-3xl mx-auto space-y-6 pb-24 w-full">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center mb-6"
      >
        <div className="w-16 h-16 mx-auto mb-4 bg-primary/10 rounded-2xl flex items-center justify-center">
          <Globe className="w-8 h-8 text-primary" />
        </div>
        <h1 className="text-3xl font-display font-bold" data-testid="text-search-title">
          {t.search_global_title}
        </h1>
        <p className="text-muted-foreground mt-2" data-testid="text-search-desc">
          {t.search_global_desc}
        </p>
      </motion.div>

      {/* Search input */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="relative"
      >
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
        {isLoading && debouncedQuery.length >= 2 && (
          <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-muted-foreground" />
        )}
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t.search_type_query}
          className="pl-12 pr-12 h-14 text-base rounded-2xl border-border bg-card shadow-sm"
          autoFocus
          data-testid="input-global-search"
        />
      </motion.div>

      {/* Exchange filter tabs */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.1 }}
        className="flex gap-2 flex-wrap"
      >
        {filterTabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setFilter(tab.key)}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-semibold border transition-all",
              filter === tab.key
                ? "bg-primary text-primary-foreground border-primary shadow-sm"
                : "bg-card text-muted-foreground border-border hover:border-foreground/20 hover:bg-muted"
            )}
            data-testid={`filter-${tab.key}`}
          >
            <span>{tab.flag}</span>
            <span>{tab.label}</span>
          </button>
        ))}
      </motion.div>

      {/* Results */}
      <AnimatePresence mode="wait">
        {debouncedQuery.length < 2 ? (
          <motion.div
            key="empty"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="text-center py-16 space-y-3"
          >
            <Search className="w-12 h-12 text-muted-foreground/40 mx-auto" />
            <p className="text-muted-foreground">{t.search_min_chars}</p>
          </motion.div>
        ) : filteredResults.length === 0 && !isLoading ? (
          <motion.div
            key="no-results"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="text-center py-16 space-y-3"
          >
            <Search className="w-12 h-12 text-muted-foreground/40 mx-auto" />
            <p className="text-muted-foreground">{t.search_no_results_query} "{debouncedQuery}"</p>
          </motion.div>
        ) : (
          <motion.div
            key="results"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="space-y-2"
          >
            {filteredResults.map((result, idx) => {
              const nativeCurrency = result.currency || getNativeCurrency(result.symbol);
              const priceStr = result.price > 0
                ? formatPrice(result.price, { nativeCurrency, decimals: 2 })
                : "--";
              const isUp = result.changePercent >= 0;
              const flag = getExchangeFlag(result.symbol);

              return (
                <motion.button
                  key={result.symbol}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.03 }}
                  onClick={() => navigate(`/stock/${result.symbol}`)}
                  className="w-full flex items-center gap-4 p-4 bg-card border border-border rounded-2xl hover:bg-muted/50 hover:border-foreground/20 transition-all text-left group"
                  data-testid={`search-result-${result.symbol}`}
                >
                  {/* Flag + symbol */}
                  <div className="w-12 h-12 rounded-xl bg-muted flex flex-col items-center justify-center shrink-0">
                    <span className="text-lg leading-none">{flag}</span>
                  </div>

                  {/* Name info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm font-mono">{result.symbol}</span>
                      {result.sector && (
                        <span className="text-[10px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded-full hidden sm:inline">
                          {result.sector}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground truncate max-w-[200px] sm:max-w-none">
                      {result.name}
                    </p>
                  </div>

                  {/* Price */}
                  <div className="text-right shrink-0">
                    <p className="font-bold text-base" data-testid={`price-${result.symbol}`}>
                      {priceStr}
                    </p>
                    {result.changePercent !== 0 && (
                      <p className={cn(
                        "text-xs font-semibold flex items-center justify-end gap-0.5",
                        isUp ? "text-emerald-500" : "text-rose-500"
                      )}>
                        {isUp ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                        {isUp ? "+" : ""}{result.changePercent.toFixed(2)}%
                      </p>
                    )}
                  </div>
                </motion.button>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

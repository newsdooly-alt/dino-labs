import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation, useSearch } from "wouter";
import { Search, TrendingUp, TrendingDown, Loader2, Globe, Sparkles } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useCurrency } from "@/contexts/CurrencyContext";
import { useUser } from "@/hooks/use-user";
import { translations } from "@/lib/translations";
import { motion, AnimatePresence } from "framer-motion";
import {
  containsKorean,
  searchByKoreanAlias,
  getLocalizedCompanyName,
  type KoreanStockAlias,
} from "@/lib/stockNames";

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
  if (
    s.endsWith(".DE") || s.endsWith(".PA") || s.endsWith(".MI") ||
    s.endsWith(".AS") || s.endsWith(".SW") || s.endsWith(".L") ||
    s.endsWith(".MC") || s.endsWith(".ST") || s.endsWith(".VI") ||
    s.endsWith(".OL") || s.endsWith(".CO")
  ) return "eu";
  return "us";
}

function getExchangeFlag(symbol: string): string {
  switch (getExchangeFilter(symbol)) {
    case "kr": return "🇰🇷";
    case "jp": return "🇯🇵";
    case "eu": return "🇪🇺";
    default: return "🇺🇸";
  }
}

function getNativeCurrency(symbol: string): string {
  switch (getExchangeFilter(symbol)) {
    case "kr": return "KRW";
    case "jp": return "JPY";
    case "eu": return "EUR";
    default: return "USD";
  }
}

export default function GlobalSearch() {
  const searchStr = useSearch();
  const initialQ = new URLSearchParams(searchStr).get("q") || "";

  const [query, setQuery]           = useState(initialQ);
  const [debouncedQuery, setDebounced] = useState(initialQ);
  const [filter, setFilter]         = useState<ExchangeFilter>("all");
  const [, navigate]                = useLocation();
  const { data: user }              = useUser();
  const lang  = (user?.language || "en") as keyof typeof translations;
  const t     = translations[lang];
  const isKo  = lang === "ko";
  const { formatPrice } = useCurrency();

  // Sync query when URL param changes (e.g. Dashboard navigates here)
  useEffect(() => {
    const q = new URLSearchParams(searchStr).get("q") || "";
    setQuery(q);
    setDebounced(q);
  }, [searchStr]);

  // Debounce typed query
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(query.trim()), 400);
    return () => clearTimeout(timer);
  }, [query]);

  // ── API search (English / ticker) ─────────────────────────────────────────
  const isKoreanQuery = containsKorean(debouncedQuery);

  const { data: apiData, isLoading: isApiLoading } = useQuery<{ results: SearchResult[] }>({
    queryKey: ["/api/stocks/search", debouncedQuery],
    queryFn: async () => {
      if (debouncedQuery.length < 2) return { results: [] };
      const res = await fetch(`/api/stocks/search?query=${encodeURIComponent(debouncedQuery)}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Search failed");
      return res.json();
    },
    enabled: debouncedQuery.length >= 2 && !isKoreanQuery,
    staleTime: 30_000,
  });

  // ── Korean alias matches ───────────────────────────────────────────────────
  const koreanAliasMatches: KoreanStockAlias[] = isKoreanQuery && debouncedQuery.length >= 1
    ? searchByKoreanAlias(debouncedQuery)
    : [];

  const koreanTickers = koreanAliasMatches.map(m => m.ticker);

  const { data: koreanPriceData, isLoading: isKoreanLoading } = useQuery<{
    quotes: { symbol: string; name: string; price: number; change: number; changePercent: number }[];
  }>({
    queryKey: ["/api/stocks/live", koreanTickers.join(",")],
    queryFn: async () => {
      if (!koreanTickers.length) return { quotes: [] };
      const res = await fetch(`/api/stocks/live?symbols=${koreanTickers.join(",")}`, {
        credentials: "include",
      });
      if (!res.ok) return { quotes: [] };
      return res.json();
    },
    enabled: koreanTickers.length > 0,
    staleTime: 30_000,
  });

  // Merge Korean alias results with live price data
  const koreanResults: SearchResult[] = koreanAliasMatches.map(alias => {
    const liveQuote = koreanPriceData?.quotes?.find(q => q.symbol === alias.ticker);
    return {
      symbol:        alias.ticker,
      name:          alias.en,
      price:         liveQuote?.price         ?? 0,
      change:        liveQuote?.change         ?? 0,
      changePercent: liveQuote?.changePercent  ?? 0,
      currency:      getNativeCurrency(alias.ticker),
    };
  });

  // ── Combined results ───────────────────────────────────────────────────────
  const apiResults: SearchResult[] = apiData?.results ?? (apiData as any) ?? [];
  const allResults = isKoreanQuery ? koreanResults : apiResults;
  const isLoading  = isKoreanQuery ? isKoreanLoading : isApiLoading;

  const filteredResults = filter === "all"
    ? allResults
    : allResults.filter(r => getExchangeFilter(r.symbol) === filter);

  const filterTabs: { key: ExchangeFilter; label: string; flag: string }[] = [
    { key: "all", label: t.search_all,       flag: "🌍" },
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
          {isKo
            ? "미국·한국·일본·유럽 주식을 한국어로도 검색하세요"
            : "Search US, Korea, Japan & Europe stocks — try Korean names too"}
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
        {isLoading && debouncedQuery.length >= 1 && (
          <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-muted-foreground" />
        )}
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={isKo
            ? "도요타, 삼성전자, 엔비디아, AAPL…"
            : "Search by name, ticker, or Korean name…"}
          className="pl-12 pr-12 h-14 text-base rounded-2xl border-border bg-card shadow-sm"
          autoFocus
          data-testid="input-global-search"
        />
      </motion.div>

      {/* Korean mode hint */}
      <AnimatePresence>
        {isKoreanQuery && debouncedQuery.length >= 1 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="flex items-center gap-2 text-sm text-primary font-medium px-1"
          >
            <Sparkles className="w-4 h-4 shrink-0" />
            <span>
              {isKo
                ? `한국어 이름으로 검색 중: "${debouncedQuery}"`
                : `Searching by Korean name: "${debouncedQuery}"`}
            </span>
          </motion.div>
        )}
      </AnimatePresence>

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
            type="button"
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
        {debouncedQuery.length < 1 ? (
          <motion.div
            key="empty"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="text-center py-16 space-y-3"
          >
            <Search className="w-12 h-12 text-muted-foreground/40 mx-auto" />
            <p className="text-muted-foreground font-medium">
              {isKo ? "종목 이름, 티커, 또는 한국어 이름을 입력하세요" : "Type a company name, ticker, or Korean name"}
            </p>
            <p className="text-sm text-muted-foreground/60">
              {isKo ? "예: 도요타, NVDA, 노보 노디스크, 삼성전자" : "e.g. NVDA, Toyota, 도요타, Novo Nordisk, 노보 노디스크"}
            </p>
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
            <p className="text-muted-foreground">
              {isKo ? `"${debouncedQuery}" 검색 결과 없음` : `No results for "${debouncedQuery}"`}
            </p>
            <p className="text-sm text-muted-foreground/60">
              {isKo ? "다른 검색어나 티커를 시도해 보세요" : "Try a different name or ticker symbol"}
            </p>
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
              const nativeCurrency  = result.currency || getNativeCurrency(result.symbol);
              const priceStr        = result.price > 0
                ? formatPrice(result.price, { nativeCurrency, decimals: 2 })
                : "--";
              const isUp   = result.changePercent >= 0;
              const flag   = getExchangeFlag(result.symbol);

              // Find Korean display name for this result
              const koAlias  = koreanAliasMatches.find(a => a.ticker === result.symbol);
              const koName   = koAlias?.ko ?? getLocalizedCompanyName(result.name, lang);
              const displayName = isKo ? koName : result.name;

              return (
                <motion.button
                  key={result.symbol}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.03 }}
                  type="button"
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
                      {displayName}
                    </p>
                    {/* Show English name as secondary when Korean */}
                    {isKo && koName !== result.name && (
                      <p className="text-xs text-muted-foreground/50 truncate">
                        {result.name}
                      </p>
                    )}
                  </div>

                  {/* Price */}
                  <div className="text-right shrink-0">
                    <p className="font-bold text-base" data-testid={`price-${result.symbol}`}>
                      {priceStr}
                    </p>
                    {result.changePercent != null && result.changePercent !== 0 && (
                      <p className={cn(
                        "text-xs font-semibold flex items-center justify-end gap-0.5",
                        isUp ? "text-emerald-500" : "text-rose-500"
                      )}>
                        {isUp ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                        {isUp ? "+" : ""}{(result.changePercent ?? 0).toFixed(2)}%
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

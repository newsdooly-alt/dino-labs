import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useUser } from "@/hooks/use-user";
import { Search, Plus, AlertCircle, Star } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { translations } from "@/lib/translations";
import { useToast } from "@/hooks/use-toast";
import { LiveStockCard } from "@/components/LiveStockCard";
import { useCurrency } from "@/contexts/CurrencyContext";

interface SearchResult {
  id: number;
  symbol: string;
  name: string;
  sector: string;
  lastPrice: string | null;
  changePercent: string | null;
  region?: string;
  currency?: string;
  isKorean?: boolean;
  market?: string;
}

interface WatchlistItem {
  id: number;
  userId: number;
  symbol: string;
  addedAt: string;
  stockName?: string;
}

export default function Watchlist() {
  const { data: user } = useUser();
  const lang = user?.language || "en";
  const t = translations[lang as keyof typeof translations];
  const { toast } = useToast();
  const { isKoreanStock } = useCurrency();
  
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [showDinoTip, setShowDinoTip] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  
  // Debounce search query and clear error when query is cleared
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(searchQuery), 500);
    if (searchQuery.length < 2) {
      setSearchError(null);
    }
    return () => clearTimeout(timer);
  }, [searchQuery]);
  
  // Fetch watchlist
  const { data: watchlist, isLoading: isWatchlistLoading } = useQuery<WatchlistItem[]>({
    queryKey: ["/api/watchlist"],
  });
  
  // Search stocks
  const { data: searchResults, isLoading: isSearching } = useQuery<SearchResult[]>({
    queryKey: ["/api/stocks/search", debouncedQuery],
    queryFn: async () => {
      if (!debouncedQuery || debouncedQuery.length < 2) return [];
      setSearchError(null);
      const res = await fetch(`/api/stocks/search?query=${encodeURIComponent(debouncedQuery)}`);
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        const dinoMsg = errData.dinoMessage || "Dino couldn't search right now!";
        setSearchError(dinoMsg);
        return [];
      }
      return res.json();
    },
    enabled: debouncedQuery.length >= 2,
  });
  
  // Add to watchlist mutation
  const addMutation = useMutation({
    mutationFn: async ({ symbol, name }: { symbol: string; name?: string }) => {
      return apiRequest("POST", "/api/watchlist", { symbol, name });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/watchlist"] });
      setSearchQuery("");
      setShowDinoTip(true);
      setTimeout(() => setShowDinoTip(false), 3000);
    },
  });
  
  // Remove from watchlist mutation
  const removeMutation = useMutation({
    mutationFn: async (symbol: string) => {
      return apiRequest("DELETE", `/api/watchlist/${symbol}`, {});
    },
    onSuccess: (_data, removedSymbol) => {
      queryClient.invalidateQueries({ queryKey: ["/api/watchlist"] });
      toast({
        title: lang === "ko" 
          ? `${removedSymbol}을(를) 삭제했어요!` 
          : `Removed ${removedSymbol} from your list!`,
        duration: 2000,
      });
    },
  });

  const watchlistSymbols = watchlist?.map(w => w.symbol) || [];

  return (
    <div className="p-4 md:p-10 max-w-5xl mx-auto w-full">
      {/* Dino Tip Toast */}
      <AnimatePresence>
        {showDinoTip && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-20 right-6 z-50 bg-primary text-primary-foreground px-6 py-4 rounded-2xl shadow-xl flex items-center gap-3"
          >
            <Star className="w-6 h-6" />
            <p className="font-medium">{t.stock_added}</p>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
        <div>
          <h1 className="text-3xl md:text-4xl font-display font-bold">{t.your_watchlist}</h1>
          <p className="text-muted-foreground mt-2">{t.track_stocks}</p>
        </div>
        
        {/* Search Bar */}
        <div className="relative w-full md:w-96 z-20">
          <div className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground">
             <Search className="w-5 h-5" />
          </div>
          <input 
            type="text" 
            placeholder={t.search_placeholder}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-12 pr-4 py-4 bg-card border border-border rounded-2xl focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all shadow-lg"
            data-testid="input-stock-search"
          />
          
          {/* Search Dropdown */}
          <AnimatePresence>
            {searchQuery.length >= 2 && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                className="absolute top-full left-0 right-0 mt-2 bg-popover border border-border rounded-2xl shadow-2xl overflow-hidden max-h-[300px] overflow-y-auto z-50"
              >
                {isSearching ? (
                  <div className="p-4 text-center text-muted-foreground">{t.searching}</div>
                ) : searchError ? (
                  <div className="p-4 text-center">
                    <AlertCircle className="w-6 h-6 mx-auto mb-2 text-primary/60" />
                    <p className="text-sm text-muted-foreground italic">{searchError}</p>
                  </div>
                ) : searchResults && searchResults.length > 0 ? (
                  searchResults.map((stock, idx) => (
                    <div 
                      key={`${stock.symbol}-${idx}`} 
                      className="flex items-center justify-between gap-2 p-4 hover:bg-muted transition-colors cursor-pointer border-b border-border/50 last:border-0"
                      data-testid={`search-result-${stock.symbol}`}
                    >
                       <div className="flex-1 min-w-0">
                         <div className="flex items-center gap-2 flex-wrap">
                           <span className="font-bold text-sm">
                             {stock.isKorean ? stock.name.split(' (')[0] : stock.symbol}
                           </span>
                           <span className="text-xs text-muted-foreground">
                             {stock.isKorean ? stock.symbol : ''}
                           </span>
                           {stock.isKorean && (
                             <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-600 dark:text-blue-400 shrink-0">
                               {stock.market || 'KRX'}
                             </span>
                           )}
                           {stock.isKorean && (
                             <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-muted text-muted-foreground shrink-0">
                               KRW
                             </span>
                           )}
                         </div>
                         <p className="text-sm text-muted-foreground truncate mt-0.5">
                           {stock.isKorean ? stock.name : stock.name}
                         </p>
                       </div>
                       <button
                         onClick={() => addMutation.mutate({ symbol: stock.symbol, name: stock.name })}
                         disabled={addMutation.isPending || watchlistSymbols.includes(stock.symbol)}
                         className={cn(
                           "p-2 rounded-lg transition-colors shrink-0",
                           watchlistSymbols.includes(stock.symbol)
                             ? "bg-muted text-muted-foreground cursor-not-allowed"
                             : "bg-primary/10 text-primary hover:bg-primary hover:text-white"
                         )}
                         data-testid={`button-add-${stock.symbol}`}
                       >
                         {watchlistSymbols.includes(stock.symbol) ? (
                           <Star className="w-4 h-4 fill-current" />
                         ) : (
                           <Plus className="w-4 h-4" />
                         )}
                       </button>
                    </div>
                  ))
                ) : (
                  <div className="p-4 text-center text-muted-foreground">{t.no_results}</div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {isWatchlistLoading ? (
        <div className="space-y-4">
          {[1, 2, 3, 4].map(i => (
             <div key={i} className="h-20 bg-card/50 rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : watchlist && watchlist.length > 0 ? (
        <div className="bg-card border border-border rounded-3xl p-6 shadow-lg">
          <LiveStockCard symbols={watchlistSymbols} />
          
          <div className="mt-6 pt-4 border-t border-border">
            <p className="text-xs text-muted-foreground text-center">
              {lang === "ko" 
                ? "종목을 삭제하려면 아래에서 관리하세요"
                : "Manage your stocks below to remove them"
              }
            </p>
            <div className="mt-4 space-y-2">
              {watchlist.map((item) => (
                <div key={item.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-xl">
                  <div className="min-w-0">
                    {isKoreanStock(item.symbol) && item.stockName ? (
                      <>
                        <span className="font-bold">{item.stockName.split(' (')[0]}</span>
                        <span className="ml-2 text-xs text-muted-foreground">{item.symbol}</span>
                        <span className="ml-1 text-[10px] font-bold px-1 py-0.5 rounded bg-blue-500/10 text-blue-600 dark:text-blue-400">
                          {item.symbol.endsWith('.KQ') ? 'KOSDAQ' : 'KOSPI'}
                        </span>
                      </>
                    ) : (
                      <span className="font-bold">{item.stockName || item.symbol}</span>
                    )}
                  </div>
                  <button
                    onClick={() => removeMutation.mutate(item.symbol)}
                    disabled={removeMutation.isPending}
                    className="text-xs text-destructive hover:text-destructive/80 font-medium"
                    data-testid={`button-remove-${item.symbol}`}
                  >
                    {t.remove_from_watchlist}
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="text-center py-20 bg-card/30 rounded-3xl border border-dashed border-border">
          <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4 text-muted-foreground">
             <AlertCircle className="w-8 h-8" />
          </div>
          <h3 className="text-xl font-bold mb-2">{t.watchlist_empty}</h3>
          <p className="text-muted-foreground">{t.watchlist_empty_hint}</p>
        </div>
      )}
    </div>
  );
}

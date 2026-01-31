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

interface SearchResult {
  id: number;
  symbol: string;
  name: string;
  sector: string;
  lastPrice: string | null;
  changePercent: string | null;
}

interface WatchlistItem {
  id: number;
  userId: number;
  symbol: string;
  addedAt: string;
}

export default function Watchlist() {
  const { data: user } = useUser();
  const lang = user?.language || "en";
  const t = translations[lang as keyof typeof translations];
  const { toast } = useToast();
  
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [showDinoTip, setShowDinoTip] = useState(false);
  
  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(searchQuery), 500);
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
      const res = await fetch(`/api/stocks/search?query=${encodeURIComponent(debouncedQuery)}`);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: debouncedQuery.length >= 2,
  });
  
  // Add to watchlist mutation
  const addMutation = useMutation({
    mutationFn: async (symbol: string) => {
      return apiRequest("POST", "/api/watchlist", { userId: 1, symbol });
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
    mutationFn: async (id: number) => {
      return apiRequest("DELETE", `/api/watchlist/${id}`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/watchlist"] });
    },
  });

  const watchlistSymbols = watchlist?.map(w => w.symbol) || [];

  return (
    <div className="p-6 md:p-10 max-w-5xl mx-auto">
      {/* Dino Tip Toast */}
      <AnimatePresence>
        {showDinoTip && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-20 right-6 z-50 bg-primary text-primary-foreground px-6 py-4 rounded-2xl shadow-xl flex items-center gap-3"
          >
            <span className="text-2xl">🦕</span>
            <p className="font-medium">{t.stock_added}</p>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
        <div>
          <h1 className="text-4xl font-display font-bold">{t.your_watchlist}</h1>
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
                ) : searchResults && searchResults.length > 0 ? (
                  searchResults.map((stock, idx) => (
                    <div 
                      key={`${stock.symbol}-${idx}`} 
                      className="flex items-center justify-between p-4 hover:bg-muted transition-colors cursor-pointer border-b border-border/50 last:border-0"
                      data-testid={`search-result-${stock.symbol}`}
                    >
                       <div>
                         <span className="font-bold mr-2">{stock.symbol}</span>
                         <span className="text-sm text-muted-foreground">{stock.name}</span>
                       </div>
                       <button
                         onClick={() => addMutation.mutate(stock.symbol)}
                         disabled={addMutation.isPending || watchlistSymbols.includes(stock.symbol)}
                         className={cn(
                           "p-2 rounded-lg transition-colors",
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
                  <span className="font-bold">{item.symbol}</span>
                  <button
                    onClick={() => removeMutation.mutate(item.id)}
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
